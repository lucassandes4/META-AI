# Meta AI Batch Video Automation

Extensão Chrome (Manifest V3) para automatizar o envio de imagens e download de vídeos no Meta AI.

## Como usar

1. Abra `https://www.meta.ai` e navegue até o chat/projeto que gera vídeo a partir de imagem.
2. Instale a extensão em modo desenvolvedor:
   - `chrome://extensions` → **Load unpacked** → selecione a pasta `extension`.
3. Abra o side panel da extensão.
4. Selecione as imagens, digite o prompt e ajuste o timeout.
5. Clique em **Start** e mantenha a aba do Meta AI ativa.

## Como a automação funciona

- A extensão procura um `<input type="file">` no DOM ou em `shadowRoot` e injeta o arquivo via `DataTransfer`.
- Se não encontrar o input, tenta disparar `dragover/drop` no documento.
- O prompt é inserido no campo de texto do chat e o botão de envio é clicado.
- A geração do vídeo é detectada contando botões de download antes/depois.
- O download usa a API `chrome.downloads` com nome baseado no arquivo de origem.

## Ajustes esperados

O Meta AI muda com frequência. Se o fluxo falhar:

- Inspecione o DOM para identificar seletores mais específicos de upload/composer/send.
- Atualize as funções `findFileInput`, `findComposer`, `findSendButton`, `findDownloadButtons` e `findDownloadUrl` em `extension/content.js`.
- Caso o botão de download não exponha URL, valide se existe um `<video>` na mesma mensagem ou se há um atributo de URL.

## Permissões

- `downloads`: renomear arquivos baixados.
- `activeTab`/`host_permissions`: acesso à aba do Meta AI.
- `scripting`: comunicação com a aba ativa.

