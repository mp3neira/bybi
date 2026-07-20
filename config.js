// ============================================================
// Configuração do Supabase
// Troque os dois valores abaixo pelos do SEU projeto:
// Painel do Supabase → Project Settings → API
// ============================================================
const SUPABASE_URL = 'https://mdepudjnesjwcduwwcal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZXB1ZGpuZXNqd2NkdXd3Y2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MDYwMzcsImV4cCI6MjEwMDA4MjAzN30.Ei3DSoale1hhFsxeFGHLs0yqPi0Chj-k3S8mfZTZzvY';     // chave longa que começa com eyJ...

// Cria o cliente que o resto do site vai usar (variável global "sb")
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nome do bucket de imagens no Supabase Storage
const PRODUCT_IMAGES_BUCKET = 'product-images';

// ============================================================
// Login do painel admin
// ============================================================
// A área da loja agora usa o login de verdade do Supabase (Authentication),
// não mais uma senha fixa escrita no código.
// Passo a passo pra configurar (uma vez só):
//   1. No painel do Supabase → Authentication → Users → "Add user"
//   2. Cadastre o e-mail abaixo (pode trocar por outro) e uma senha forte
//   3. Em Authentication → Providers → Email, deixe "Allow new users to sign up" DESLIGADO
//      (assim ninguém consegue criar uma conta nova sozinho, só quem você cadastrar)
// A Gabi só vai digitar a senha na tela de login — o e-mail fica fixo aqui.
const ADMIN_EMAIL = 'gabrielagossler10@gmail.com'; // troque pelo e-mail que você cadastrar no Supabase Auth
