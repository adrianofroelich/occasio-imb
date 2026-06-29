-- Migração: Cria gatilho para envio de notificações push via pg_net
-- Criado em: 29/06/2026

CREATE OR REPLACE FUNCTION public.trg_fn_notify_on_history_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  -- Monta o payload contendo o tipo do evento e o registro do histórico inserido
  v_payload := jsonb_build_object(
    'type', 'historico_insert',
    'record', row_to_json(NEW)::jsonb
  );

  -- Dispara a chamada HTTP POST assíncrona para a Edge Function 'send-push'
  PERFORM net.http_post(
    url := 'https://vdagkgahjykyxvisgfkp.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', 'occasio_push_trigger_secret_998124'
    ),
    body := v_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associa o trigger à tabela public.historico_chamados
DROP TRIGGER IF EXISTS on_history_inserted ON public.historico_chamados;

CREATE TRIGGER on_history_inserted
AFTER INSERT ON public.historico_chamados
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_on_history_insert();
