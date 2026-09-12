# Reels 40+ — Dashboard

Painel de acompanhamento dos 20 Reels do Dr. Vitor Sabioni (Grupo GH). Front estático (`index.html`) + uma função serverless (`api/reels.js`) que guarda o status de cada Reel num banco Redis — assim qualquer pessoa com o link vê e edita o mesmo estado, sem depender de conta ou organização do Claude.

## Como colocar no ar (uma vez só)

1. **Suba este projeto pro GitHub.** Crie um repositório vazio em github.com (ex: `reels-40mais-dashboard`) e rode, dentro desta pasta:
   ```bash
   git init
   git add -A
   git commit -m "Dashboard Reels 40+"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/reels-40mais-dashboard.git
   git push -u origin main
   ```

2. **Importe na Vercel.** Em vercel.com → *Add New* → *Project* → selecione o repositório que acabou de criar → *Deploy*. Não precisa mexer em nenhuma configuração (é um projeto estático + uma função serverless, a Vercel detecta sozinha).

3. **Adicione um banco Redis.** Dentro do projeto na Vercel, aba **Storage** → *Create Database* → **Upstash for Redis** (grátis) → conecte ao projeto. A Vercel injeta as variáveis de ambiente automaticamente (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, ou o nome antigo `KV_REST_API_*` — o código aceita os dois).

4. **Redeploy.** Depois de conectar o banco, force um novo deploy (aba *Deployments* → menu "..." → *Redeploy*) pra função serverless pegar as variáveis novas.

Pronto — o link que a Vercel te dá (algo como `reels-40mais-dashboard.vercel.app`) já funciona pra qualquer pessoa, em qualquer conta, sem trava de versão.

## Como funciona

- `index.html` é o painel inteiro (dados dos 20 Reels embutidos no próprio arquivo — só o *status*, *responsável* e *notas* de cada um ficam no banco).
- `api/reels.js` expõe `GET /api/reels` (lê o estado atual) e `POST /api/reels` (`{id, patch}`, mescla e salva).
- O painel busca o estado ao abrir, a cada clique/edição, a cada ~8s em segundo plano, e sempre que a aba volta a ficar visível — assim a marcação de uma pessoa aparece pras outras sem precisar recarregar a página manualmente.

## Atualizar o conteúdo dos Reels

O roteiro, cenário, hashtags etc. de cada Reel são dados fixos dentro de `index.html` (array `REELS`). Para mudar o texto de um Reel, edite esse array e faça `git push` de novo — a Vercel redeploya sozinha a cada push na branch `main`.

