-- ============================================================
-- Schema Bybi — Supabase (PostgreSQL)
-- Cole isso no SQL Editor do Supabase e execute.
-- ============================================================

-- Extensão pra gerar UUID automaticamente (o Supabase já vem com ela,
-- mas não custa garantir)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Categorias
-- ------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Produtos
-- ------------------------------------------------------------
create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category_id uuid references categories(id) on delete set null,
  price       numeric(10,2) not null check (price >= 0),
  badge       text,                 -- ex: "Feito à mão", "Mais vendida" (pode ser nulo)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Variantes de cor de cada produto
-- ------------------------------------------------------------
create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  color_name  text not null,        -- ex: "Cinza chumbo"
  hex_color   text not null,        -- ex: "#7d7d78"
  image_url   text not null,        -- URL da foto (Supabase Storage ou externa)
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3b. Fotos extras de cada variante (até 10 por cor)
-- ------------------------------------------------------------
create table product_images (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references product_variants(id) on delete cascade,
  image_url   text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Pedidos
-- ------------------------------------------------------------
create type order_status as enum ('novo', 'combinando', 'pago', 'enviado', 'cancelado');
create type payment_preference as enum ('Pix', 'Cartão', 'A combinar');

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  customer_name       text not null,
  customer_phone      text not null,      -- WhatsApp, com DDD
  customer_cep        text not null,
  customer_city       text not null,
  customer_address    text not null,
  customer_number     text not null,
  payment_preference  payment_preference not null default 'A combinar',
  status              order_status not null default 'novo',
  shipping_cost       numeric(10,2) not null default 0,
  total               numeric(10,2) not null check (total >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. Itens de cada pedido
-- ------------------------------------------------------------
create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,      -- guarda o nome no momento da compra
  variant_name  text not null,      -- cor escolhida, ex: "Marrom café"
  quantity      int not null check (quantity > 0),
  unit_price    numeric(10,2) not null check (unit_price >= 0)
);

-- ------------------------------------------------------------
-- 6. Depoimentos (opcional, hoje é fixo no código)
-- ------------------------------------------------------------
create table testimonials (
  id          uuid primary key default gen_random_uuid(),
  customer_name text not null default 'Cliente Bybi',
  text        text not null,
  approved    boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. Newsletter (e-mails cadastrados no rodapé do site)
-- ------------------------------------------------------------
create table newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices úteis
-- ------------------------------------------------------------
create index idx_products_category on products(category_id);
create index idx_variants_product on product_variants(product_id);
create index idx_images_variant on product_images(variant_id);
create index idx_order_items_order on order_items(order_id);
create index idx_orders_status on orders(status);

-- ------------------------------------------------------------
-- Segurança (RLS) — Supabase liga isso por padrão em projetos novos.
-- Ajuste depois conforme quem vai poder ler/escrever cada tabela:
-- catálogo (categories/products/product_variants) = leitura pública,
-- escrita só autenticada (painel admin);
-- orders/order_items = escrita pública (formulário do site),
-- leitura só autenticada (painel admin).
-- ------------------------------------------------------------
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table testimonials enable row level security;
alter table newsletter_subscribers enable row level security;

-- Leitura pública do catálogo (qualquer visitante do site pode ver produtos)
create policy "catálogo é público para leitura" on categories for select using (true);
create policy "catálogo é público para leitura" on products for select using (true);
create policy "catálogo é público para leitura" on product_variants for select using (true);
create policy "catálogo é público para leitura" on product_images for select using (true);
create policy "depoimentos aprovados são públicos" on testimonials for select using (approved = true);

-- Qualquer visitante pode CRIAR um pedido (mas não ler os pedidos dos outros)
create policy "qualquer um pode criar pedido" on orders for insert with check (true);
create policy "qualquer um pode adicionar itens ao criar pedido" on order_items for insert with check (true);

-- Qualquer visitante pode se cadastrar na newsletter (mas não ler os e-mails dos outros)
create policy "qualquer um pode se cadastrar na newsletter" on newsletter_subscribers for insert with check (true);

-- ------------------------------------------------------------
-- Escrita do painel admin (categorias, produtos, variantes, depoimentos e pedidos)
-- Só quem estiver logado (via Supabase Auth, veja ADMIN_EMAIL em config.js) pode
-- criar, editar ou excluir. Sem essas políticas, o RLS bloqueia por padrão —
-- foi por isso que excluir categoria (e qualquer outra edição) não funcionava.
-- ------------------------------------------------------------
create policy "admin autenticado gerencia categorias" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin autenticado gerencia produtos" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin autenticado gerencia variantes" on product_variants
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin autenticado gerencia fotos" on product_images
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin autenticado gerencia depoimentos" on testimonials
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin autenticado le newsletter" on newsletter_subscribers
  for select using (auth.role() = 'authenticated');
create policy "admin autenticado exclui newsletter" on newsletter_subscribers
  for delete using (auth.role() = 'authenticated');

-- Pedidos: o formulário público só cria (policy acima); ler, atualizar status
-- e excluir fica restrito a quem está logado no painel.
create policy "admin autenticado le pedidos" on orders
  for select using (auth.role() = 'authenticated');
create policy "admin autenticado atualiza pedidos" on orders
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin autenticado exclui pedidos" on orders
  for delete using (auth.role() = 'authenticated');

create policy "admin autenticado le itens de pedido" on order_items
  for select using (auth.role() = 'authenticated');
create policy "admin autenticado exclui itens de pedido" on order_items
  for delete using (auth.role() = 'authenticated');
