# Central de Operações — Brico Pais

Aplicação interna da Brico Pais | João Pais & Filhas, Lda., para gerir orçamentos,
fornecedores, faturação e entregas, com login separado para a gestão e para a
equipa de entregas.

## Como correr localmente (opcional, só para quem souber programar)

```
npm install
npm run dev
```

## Como publicar

Este projeto está pronto para ser publicado na Netlify:

1. Faça upload de todos estes ficheiros para um repositório novo no GitHub
   (menos as pastas `node_modules` e `dist`, que não são precisas).
2. Na Netlify, escolha "Add new site" → "Import an existing project" → selecione
   este repositório.
3. Configurações de build:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Clique em "Deploy".

Não é preciso configurar nenhuma variável de ambiente — a ligação à Supabase já
vem configurada no código (a chave usada é pública por natureza, protegida
pelas regras de acesso configuradas na base de dados).
