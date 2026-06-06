# Galeria das Ervas — versão Google Sheets + Apps Script

Esta versão usa:

- **GitHub Pages** para hospedar o site público.
- **Google Apps Script** para rodar o painel administrativo e a API.
- **Google Sheets** como banco de dados.
- **Google Drive** para armazenar imagens enviadas pelo painel.

## Importante: preciso criar a planilha manualmente?

**Não precisa criar a planilha manualmente.**

O próprio Apps Script cria automaticamente uma planilha chamada:

```txt
Galeria das Ervas - Base do Site
```

Ele também cria automaticamente uma pasta no Google Drive chamada:

```txt
Galeria das Ervas - Imagens do Site
```

A diferença desta versão é que a planilha e a pasta de imagens são criadas dentro da pasta principal do cliente no Drive:

```txt
https://drive.google.com/drive/u/0/folders/1wNeW_QrCNAiYygKHOjQ3zGj8UFopnbez
```

Isso acontece na primeira vez que você abre o painel do Apps Script.

Mesmo assim, é bom entender o que ele cria por trás.

## Abas criadas automaticamente na planilha

O painel cria estas abas:

```txt
configuracoes
categorias
produtos
blog
depoimentos
```

## Aba `configuracoes`

Colunas:

```txt
key | label | value | type | help | active
```

Exemplos de campos:

```txt
whatsapp
telefone_fixo
email
endereco
instagram
facebook
logo_url
hero_url
footer_text
x_twitter
```

A coluna `active` controla se aquele dado aparece ou não no site. Exemplo: se `facebook` estiver desativado, o ícone do Facebook não aparece no cabeçalho, no menu mobile nem no rodapé.

Quando você altera o WhatsApp, e-mail ou endereço no painel, esses dados mudam em todos os lugares do site onde aparecem.

## Aba `produtos`

Colunas:

```txt
id | name | category | description | benefits | image_url | featured | active | order
```

Uso:

- `name`: nome do produto.
- `category`: categoria do produto.
- `description`: descrição curta.
- `benefits`: características ou benefícios.
- `image_url`: link da imagem.
- `featured`: se aparece em destaque na Home.
- `active`: se aparece ou não no site.
- `order`: ordem de exibição.

## Aba `categorias`

Colunas:

```txt
id | name | description | active | order
```

## Aba `blog`

Colunas:

```txt
id | title | excerpt | body | cover_url | published | order
```

## Aba `depoimentos`

Colunas:

```txt
id | name | text | photo_url | rating | active | order
```

---

# Como configurar o Apps Script

## 1. Criar o projeto

1. Acesse:

```txt
https://script.google.com
```

2. Clique em **Novo projeto**.

3. Apague o conteúdo inicial do arquivo `Code.gs`.

4. Copie o conteúdo do arquivo abaixo:

```txt
apps-script/Code.gs
```

5. Cole dentro do `Code.gs` no Apps Script.

---

## 2. Criar o arquivo HTML do painel

1. No Apps Script, clique no botão **+**.
2. Escolha **HTML**.
3. Dê o nome:

```txt
Index
```

4. Copie o conteúdo do arquivo:

```txt
apps-script/Index.html
```

5. Cole dentro do arquivo `Index.html` criado no Apps Script.

---

## 3. Configurar o `appsscript.json`

1. No Apps Script, vá em **Configurações do projeto**.
2. Ative a opção:

```txt
Mostrar arquivo de manifesto "appsscript.json" no editor
```

3. Volte para o editor.
4. Abra o arquivo `appsscript.json`.
5. Apague o conteúdo atual.
6. Copie o conteúdo do arquivo:

```txt
apps-script/appsscript.json
```

7. Cole no `appsscript.json`.

---

## 4. Implantar como App da Web

1. Clique em **Implantar**.
2. Clique em **Nova implantação**.
3. Em tipo, escolha:

```txt
App da Web
```

4. Em **Executar como**, escolha:

```txt
Eu
```

5. Em **Quem pode acessar**, escolha:

```txt
Qualquer pessoa
```

6. Clique em **Implantar**.
7. Autorize as permissões.
8. Copie a URL gerada do App da Web.

---

## 5. Abrir o painel pela primeira vez

Cole a URL do App da Web no navegador.

Na primeira abertura, o Apps Script vai criar automaticamente:

- a planilha com as abas corretas;
- alguns dados de exemplo;
- a pasta de imagens no Google Drive.

Dentro do painel aparecerão os links para:

- abrir a planilha;
- abrir a pasta de imagens.

---

## 6. Conectar o site do GitHub Pages ao Apps Script

No projeto do site, abra:

```txt
assets/js/config.js
```

Procure:

```js
window.APPS_SCRIPT_URL = "COLE_AQUI_A_URL_DO_APPS_SCRIPT";
```

Troque pelo link do seu Web App.

Exemplo:

```js
window.APPS_SCRIPT_URL = "https://script.google.com/macros/s/SEU_ID/exec";
```

Depois suba novamente esse arquivo no GitHub, no mesmo lugar:

```txt
assets/js/config.js
```

---

# Visual do painel

O painel foi redesenhado para ter mais presença da marca **Galeria das Ervas**, com cores, cantos, cartões e linguagem visual próximos da Home do site.

Também foi adicionado controle de ativo/desativo nos dados gerais. Isso permite cadastrar uma rede social ou telefone, mas escolher se aparece ou não no site.

# O que a cliente vai editar pelo painel

Ela poderá editar:

- dados gerais;
- WhatsApp;
- telefone fixo;
- e-mail;
- endereço;
- Instagram;
- Facebook;
- X / Twitter;
- ativar ou desativar cada dado geral;
- logo;
- banner da Home;
- produtos;
- imagens dos produtos;
- blog;
- imagens do blog;
- depoimentos;
- fotos dos depoimentos;
- categorias.

Ela não precisa mexer em HTML.

---

# Observação importante

A planilha existe, mas ela não precisa ser editada diretamente.

O fluxo ideal é:

```txt
Cliente acessa o painel
↓
Painel salva no Apps Script
↓
Apps Script grava na planilha
↓
Site lê os dados atualizados
```

Ou seja: a planilha é o banco de dados, mas o painel é a tela de edição.
