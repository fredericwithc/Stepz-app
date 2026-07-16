-- Limpeza opcional: apaga o histórico repetitivo actual (NÃO mexe em user_state).
-- Substitui o UUID pelo teu user_id (Table Editor → user_state_history → coluna user_id).
-- Depois do fix de dedupe/throttle, novas entradas deixam de spammar.

-- Opção A — recomeçar o histórico deste utilizador:
-- delete from public.user_state_history
-- where user_id = '77720d1f-2586-4294-a728-2d757a647eb2';

-- Opção B — apagar só duplicados exactos (mantém a linha mais recente de cada state idêntico):
delete from public.user_state_history h
using public.user_state_history newer
where h.user_id = newer.user_id
  and h.state = newer.state
  and h.created_at < newer.created_at
  and h.user_id = '77720d1f-2586-4294-a728-2d757a647eb2';
