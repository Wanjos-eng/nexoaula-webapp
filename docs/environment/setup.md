# Ambiente local: instalação segura e repetível

## Caminhos e versões

- Frontend: `Front-end`, Node.js 22.13+ na linha 22.x ou 24.x, com npm.
- API: `Back-end/apps/api`, Python 3.11.x com pip e venv.
- Scripts de entrada: `setup.ps1` e `setup.sh` na raiz. Eles resolvem os caminhos
  pelo próprio arquivo, não pelo diretório atual do terminal.
- Dependências: `Front-end/package-lock.json` e
  `Back-end/apps/api/requirements.txt`. Não há requirements alternativo na raiz.

O setup confere versões e instala dependências do projeto; não instala runtimes
globais. Não garante o mesmo patch de Node/Python/npm entre computadores.
As versões admitidas estão documentadas acima; nenhuma versão nova foi adotada
nesta tarefa. O requirements tem pins diretos, mas não é um lock completo de
transitivas para todas as plataformas.

## Sistemas cobertos

| Ambiente | Script | Validação automatizada |
| --- | --- | --- |
| Windows, PowerShell 5.1 | `setup.ps1` | Setup completo duas vezes, Node 22.13.0 e 24.x |
| Linux, Bash (runner Ubuntu do GitHub) | `setup.sh` | Setup completo duas vezes, Node 22.13.0 e 24.x |
| Windows, Git Bash | `setup.sh` | Setup completo duas vezes, Node 24.x |

macOS e Cygwin não estão validados nem declarados como suportados. O script Bash
recusa esses ambientes. WSL não tem evidência de execução específica; testes
no runner Ubuntu não são uma validação automática de todas as instalações WSL.

## Privilégios e preparação manual

Execute como usuário comum em um clone no qual você tenha permissão de escrita.
Não use `sudo`, administrador ou alteração global de ExecutionPolicy para
contornar falhas do setup. Instalar runtimes manualmente pode exigir permissões
do sistema, conforme o instalador e a política da instituição; essa etapa é
externa ao script e deve ser autorizada separadamente.

1. Instale uma versão de Node suportada com npm e reabra o terminal.
2. Instale Python 3.11 incluindo pip/venv. Em distribuições Linux que separam
   esses componentes, peça a instalação do pacote de venv correspondente ao
   Python 3.11 ao administrador. Não use um pacote de outra versão do Python.
3. Confira `node --version`, `npm --version` e `py -3.11 --version` (Windows)
   ou `python3.11 --version` (Linux).
4. Use um clone completo e atualizado, preferencialmente em caminho curto no Windows.

Se o PowerShell bloquear um script baixado, examine-o e siga a política de sua
instituição. O CI usa `-ExecutionPolicy Bypass` **somente no processo de teste**,
sem alterar a política persistente; isso não é uma recomendação para ignorar
restrições administrativas do computador.

## Comandos

Na raiz, PowerShell:

```powershell
.\setup.ps1 -Check
.\setup.ps1
# Se o Python não estiver no launcher/PATH:
.\setup.ps1 -PythonExecutable 'C:\caminho\python.exe'
# Somente uma parte:
.\setup.ps1 -Target Backend
.\setup.ps1 -Target Frontend
```

Bash:

```bash
bash ./setup.sh --check
bash ./setup.sh
bash ./setup.sh --python /caminho/python3.11
bash ./setup.sh --target backend
bash ./setup.sh --target frontend
```

O modo Check só confere pré-requisitos; não testa rede nem instala dependências.
Na execução completa, todos os pré-requisitos selecionados são conferidos antes
de criar `.venv` ou instalar dependências. O script não cria/sobrescreve `.env`.

## Reexecução e falhas

O ambiente virtual existente é reutilizado somente se for Python 3.11.
`pip install -r` e `pip check` rodam dentro dele. `npm ci` reinstala `node_modules`
a partir do lockfile — esse diretório é gerado e não deve conter arquivos manuais.
Feche o servidor de desenvolvimento antes de reinstalar, especialmente no Windows.

Repetibilidade aqui significa mesmos pacotes resolvidos entre duas execuções
consecutivas, arquivos de configuração e `.env` preservados e nenhum pacote
Python global alterado. Não significa transação com rollback: uma instalação
que falhar pode deixar `.venv` ou `node_modules` parcialmente preparados.

| Falha | Ação |
| --- | --- |
| Node/npm ausente ou versão errada | Instalar/reparar versão suportada e reabrir o terminal; conferir PATH |
| Python ausente/incompatível | Instalar Python 3.11 ou indicar o executável explicitamente |
| `.venv` existente incorreto/incompleto | Inspecionar e recriar manualmente apenas esse ambiente após confirmar o caminho; o setup nunca o apaga |
| Sem pip/venv/ensurepip | Completar a instalação do Python 3.11 |
| Sem escrita ou arquivo em uso | Corrigir permissões do clone/fechar processos; não elevar privilégios do script |
| Falha de rede/proxy | Corrigir conectividade sem remover pins nem versionar credenciais |
| package.json e lock divergentes | Corrigir a alteração em uma branch revisada; não trocar `npm ci` por `npm install` para esconder o erro |
| `pip check` com conflitos | Revisar as dependências dentro da `.venv`, não instalar pacotes globais |

Falhas retornam código diferente de zero, ação corretiva e nenhuma mensagem final
de sucesso. Depois de corrigir a causa, reexecute somente a parte necessária.

## Evidência automatizada e limite humano

O workflow **Environment setup validation** executa
`scripts/validate_setup.py` nos ambientes da tabela. O validador copia somente
scripts e manifests para uma pasta temporária com espaços, cria `.env` sintéticos,
confere o preflight e executa o setup completo duas vezes a partir de outra pasta.
Compara hashes dos arquivos de entrada, a configuração da `.venv`, `pip freeze`
e `npm ls --all --json`, e verifica que os pacotes do Python externo não mudaram.
O clone e os `.env` reais não são usados como ambiente de instalação.

Exemplo manual do validador (usa rede e instala dependências em pasta temporária):

```bash
python3.11 scripts/validate_setup.py --shell bash --report setup-validation.json
```

No Windows, use `py -3.11` e `--shell powershell`. O JSON final é um artefato de
execução; não é necessário versioná-lo. Os logs ficam no GitHub Actions e os
artefatos JSON são retidos por 14 dias. O workflow **Backend checks** também testa
falhas controladas, targets isolados e repetição em fixtures sem acesso à rede.

**Exceção aceita pelo proprietário em 03/09/2026:** a conclusão da issue #9 pode
usar a validação automatizada completa em Windows/Linux em substituição à
execução por outro integrante. Não houve validação humana de outro integrante;
ela não será marcada como realizada nem inferida dos testes automatizados.
