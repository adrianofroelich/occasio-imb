-- =========================================================================
-- PROVISIONAMENTO DO BUCKET DE STORAGE E SUAS REGRAS DE SEGURANÇA (RLS)
-- =========================================================================

-- 1. Cria o bucket 'chamados-midias' como público para permitir acesso direto às fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chamados-midias', 
  'chamados-midias', 
  true, 
  2097152, -- Limite estrito de 2MB por arquivo (2 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp'] -- Apenas mídias de imagem comuns
)
ON CONFLICT (id) DO NOTHING;

-- 2. Define políticas de Row Level Security (RLS) no Supabase Storage (storage.objects)
-- Garantimos que a leitura seja pública, mas a gravação seja restrita a usuários autenticados.

-- Remove políticas anteriores para este bucket se houver, evitando conflitos
DROP POLICY IF EXISTS "Leitura publica de chamados-midias" ON storage.objects;
DROP POLICY IF EXISTS "Upload autenticado em chamados-midias" ON storage.objects;

-- Criação da política de SELECT: Qualquer usuário pode visualizar as mídias do bucket
CREATE POLICY "Leitura publica de chamados-midias"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chamados-midias');

-- Criação da política de INSERT: Apenas usuários autenticados no sistema podem realizar uploads
CREATE POLICY "Upload autenticado em chamados-midias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chamados-midias');
