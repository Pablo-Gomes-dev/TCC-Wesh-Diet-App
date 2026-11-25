# ==============================================================================
# MÓDULO DE EXTRAÇÃO E PURIFICAÇÃO DE BIOMARCADORES DE PDFS - WISHDIET
# ==============================================================================
# Este módulo processa os arquivos PDF de exames laboratoriais, valida suas
# dimensões e integridade, e extrai EXCLUSIVAMENTE os biomarcadores e dados
# clínicos úteis para a análise nutricional.
#
# RESTRIÇÃO ABSOLUTA DE SEGURANÇA E LGPD:
# Em hipótese alguma a extração traz dados pessoais, administrativos ou
# de identificação, tais como: CPF, Nome, Recebimento, Data de Geração,
# Núcleo de Assessoria Médica (NAM), FAP, Médica/Médico/CRM, Hash e CNSE/CNES.
# Todo o processamento é realizado de forma determinística e em memória RAM.
# ==============================================================================

import io
import re
from typing import Any, Dict, List
from pypdf import PdfReader
from pypdf.errors import PdfReadError

# ------------------------------------------------------------------------------
# CONSTANTES DE CONFIGURAÇÃO E SEGURANÇA
# ------------------------------------------------------------------------------
LIMITE_TAMANHO_BYTES: int = 10 * 1024 * 1024  # 10 MB

# GATILHOS DE CORTE: Identificam onde começam os rodapés ou blocos administrativos
GATILHOS_CORTE_BLOCO = [
    re.compile(r"Atendimento\s+ao\s+cliente", re.IGNORECASE),
    re.compile(r"Atendimento\s+ao\s+m[ée]dico", re.IGNORECASE),
    re.compile(r"NAM\s*-\s*N[úu]cleo", re.IGNORECASE),
    re.compile(r"N[úu]cleo\s+de\s+Assessoria\s+M[ée]dica", re.IGNORECASE),
    re.compile(r"Valide\s+seu\s+laudo", re.IGNORECASE),
    re.compile(r"Local\s+de\s+Execu[cç][aã]o", re.IGNORECASE),
    re.compile(r"Assinado\s+eletronicamente\s+por", re.IGNORECASE),
    re.compile(r"Assinatura\s+digital", re.IGNORECASE),
    re.compile(r"Respons[aá]vel\s*:\s*Dr", re.IGNORECASE),
    re.compile(r"Sob\s+a\s+responsabilidade\s+do\s+Dr", re.IGNORECASE),
    re.compile(r"\bHash\s*:\s*[a-fA-F0-9]+", re.IGNORECASE),
    re.compile(r"Laudo\s+tamb[ée]m\s+dispon[íi]vel\s+ao\s+m[ée]dico", re.IGNORECASE),
    re.compile(r"Laborat[óo]rio\s+registrado\s+no\s+CRM", re.IGNORECASE),
]

# PADRÕES PROIBIDOS: Linhas que contenham qualquer uma destas ocorrências são descartadas
PADROES_LINHAS_PROIBIDAS = [
    # 1. CPF (formatado ou apenas dígitos)
    re.compile(r"\bCPF\b", re.IGNORECASE),
    re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),

    # 2. Dados cadastrais / Nome do paciente
    re.compile(r"\bPaciente\s*:", re.IGNORECASE),
    re.compile(r"\bPaciente\b", re.IGNORECASE),
    re.compile(r"\bNome\s*:", re.IGNORECASE),
    re.compile(r"\bDN\s*:", re.IGNORECASE),
    re.compile(r"\bData\s+(?:de\s+)?nascimento\b", re.IGNORECASE),
    re.compile(r"\bIdade\s*:\s*\d+\s+anos\b", re.IGNORECASE),
    re.compile(r"\bG[êe]nero\s*:\s*(?:Masculino|Feminino|Outro)\b", re.IGNORECASE),
    re.compile(r"\bSexo\s*:\s*(?:Masculino|Feminino|Outro)\b", re.IGNORECASE),

    # 3. Recebimento e Coleta
    re.compile(r"\bRECEBIMENTO\b", re.IGNORECASE),
    re.compile(r"\bDATA\s+(?:DA\s+)?COLETA\b", re.IGNORECASE),
    re.compile(r"\bCOLETA/RECEBIMENTO\b", re.IGNORECASE),
    re.compile(r"\bHORA\s+(?:DA\s+)?COLETA\b", re.IGNORECASE),
    re.compile(r"\bDATA\s+DE\s+RECEBIMENTO\b", re.IGNORECASE),

    # 4. Data de Geração / Emissão / Impressão / Liberação
    re.compile(r"\bDATA\s+(?:DA|DE)?\s*GERA[CÇ][AÃ]O\b", re.IGNORECASE),
    re.compile(r"\bDATA\s+(?:DA|DE)?\s*EMISS[AÃ]O\b", re.IGNORECASE),
    re.compile(r"\bDATA\s+(?:DA|DE)?\s*IMPRESS[AÃ]O\b", re.IGNORECASE),
    re.compile(r"\bDATA\s+(?:DA|DE)?\s*LIBERA[CÇ][AÃ]O\b", re.IGNORECASE),

    # 5. Núcleo de Assessoria Médica e atendimento
    re.compile(r"\bN[ÚU]CLEO\s+DE\s+ASSESSORIA\s+M[ÉE]DICA\b", re.IGNORECASE),
    re.compile(r"\bASSESSORIA\s+M[ÉE]DICA\b", re.IGNORECASE),
    re.compile(r"\bNAM\b", re.IGNORECASE),
    re.compile(r"\bAtendimento\s+ao\s+m[ée]dico\b", re.IGNORECASE),
    re.compile(r"\bAtendimento\s+ao\s+cliente\b", re.IGNORECASE),

    # 6. FAP
    re.compile(r"\bFAP\s*:", re.IGNORECASE),
    re.compile(r"\bFAP\b", re.IGNORECASE),

    # 7. Médica / Médico, Solicitante, CRM e Conselhos
    re.compile(r"\bSolicitante\s*:", re.IGNORECASE),
    re.compile(r"\bM[ée]dic[oa]\s+solicitante\b", re.IGNORECASE),
    re.compile(r"\bDr[a]?\.?\s+[A-Za-zÀ-ÿ]+", re.IGNORECASE),
    re.compile(r"\bDr\(a\)", re.IGNORECASE),
    re.compile(r"\bCRM(?:-[A-Z]{2})?\b", re.IGNORECASE),
    re.compile(r"\bCRBM(?:-[A-Z]{2})?\b", re.IGNORECASE),
    re.compile(r"\bCRF(?:-[A-Z]{2})?\b", re.IGNORECASE),
    re.compile(r"\bCRBIO(?:-[A-Z]{2})?\b", re.IGNORECASE),
    re.compile(r"\bAssinado\s+eletronicamente\b", re.IGNORECASE),
    re.compile(r"\bAssinatura\s+digital\b", re.IGNORECASE),
    re.compile(r"\bRespons[aá]vel\s*:\s*Dr", re.IGNORECASE),
    re.compile(r"\bNav\s+PRO\b", re.IGNORECASE),
    re.compile(r"\batos\s+m[ée]dicos\b", re.IGNORECASE),
    re.compile(r"\bm[ée]dico\s+prescritor\b", re.IGNORECASE),

    # 8. Hash
    re.compile(r"\bHash\s*:\s*[a-fA-F0-9]+", re.IGNORECASE),
    re.compile(r"\bHash\b", re.IGNORECASE),
    re.compile(r"\b[a-fA-F0-9]{32,64}\b"),  # Hash hexadecimal isolado

    # 9. CNSE / CNES
    re.compile(r"\bCNSE\b", re.IGNORECASE),
    re.compile(r"\bCNES\b", re.IGNORECASE),

    # 10. Metadados de rastreabilidade, web, telefone e endereços
    re.compile(r"\bToken\s*:\s*\S+", re.IGNORECASE),
    re.compile(r"\bToken\b", re.IGNORECASE),
    re.compile(r"\bValide\s+seu\s+laudo\b", re.IGNORECASE),
    re.compile(r"\bQR\s*Code\b", re.IGNORECASE),
    re.compile(r"\bvalida\.[a-z0-9.-]+\b", re.IGNORECASE),
    re.compile(r"\bwww\.[a-z0-9.-]+\b", re.IGNORECASE),
    re.compile(r"\bhttps?://\S+", re.IGNORECASE),
    re.compile(r"\bP[áa]g\.\s*\d+\s+de\s+\d+\b", re.IGNORECASE),
    re.compile(r"\bLaborat[oó]rio\s+[A-Za-zÀ-ÿ]+", re.IGNORECASE),
    re.compile(r"\bTelefone\s*:\s*\(?\d{2}\)?\s*\d+", re.IGNORECASE),
    re.compile(r"\bRua\s+[A-Za-zÀ-ÿ]+", re.IGNORECASE),
    re.compile(r"\bAvenida\s+[A-Za-zÀ-ÿ]+", re.IGNORECASE),
    re.compile(r"\bBarueri\b", re.IGNORECASE),
    re.compile(r"\bSão\s+Paulo/SP\b", re.IGNORECASE),
    re.compile(r"\bLegenda\s+aplic[áa]vel\b", re.IGNORECASE),
    re.compile(r"\bconclus[ãa]o\s+diagn[óo]stica\s+s[ãa]o\s+atos\b", re.IGNORECASE),

    # Telefones residuais e números isolados resultantes de quebra de linha de cabeçalho
    re.compile(r"^\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}$"),
    re.compile(r"^\d{4,5}$"),
]


def filtrar_apenas_biomarcadores(texto: str) -> str:
    """
    Higieniza e purifica o texto do exame, extraindo estritamente os biomarcadores
    e descartando quaisquer dados pessoais, médicos ou administrativos.
    """
    if not texto:
        return ""

    linhas = texto.split("\n")
    linhas_clinicas: List[str] = []

    for linha in linhas:
        l = linha.strip()
        if not l:
            continue

        # Se atingir um marcador de início de bloco administrativo/rodapé, descarta
        if any(g.search(l) for g in GATILHOS_CORTE_BLOCO):
            continue

        # Se a linha contiver qualquer padrão proibido, descarta
        if any(p.search(l) for p in PADROES_LINHAS_PROIBIDAS):
            continue

        linhas_clinicas.append(l)

    texto_resultado = "\n".join(linhas_clinicas)

    # Segunda camada de segurança: substituições em bloco caso algo tenha escapado
    # Remove CPF
    texto_resultado = re.sub(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "", texto_resultado)
    # Remove Hashes hexadecimais
    texto_resultado = re.sub(r"\b[a-fA-F0-9]{32,64}\b", "", texto_resultado)
    # Remove telefones residuais
    texto_resultado = re.sub(r"\b\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b", "", texto_resultado)
    # Remove menções a CRM / FAP / NAM / CNES / CNSE
    texto_resultado = re.sub(r"\b(?:CRM|CRBM|CRF|CRBIO)(?:-[A-Z]{2})?\s*(?:n[ºo°]?)?\s*\d+\b", "", texto_resultado, flags=re.IGNORECASE)
    texto_resultado = re.sub(r"\bFAP\s*:\s*\d+\b", "", texto_resultado, flags=re.IGNORECASE)
    texto_resultado = re.sub(r"\bCN[ES]{2,3}\s*:\s*\d+\b", "", texto_resultado, flags=re.IGNORECASE)

    # Normalização de quebras de linha
    texto_resultado = re.sub(r"\n{3,}", "\n\n", texto_resultado).strip()
    return texto_resultado


def extrair_texto_pdf(
    conteudo_bytes: bytes,
    nome_arquivo: str = "documento.pdf",
    apenas_biomarcadores: bool = True
) -> Dict[str, Any]:
    """
    Extrai do arquivo PDF exclusivamente os biomarcadores laboratoriais úteis,
    expurgando completamente dados pessoais e administrativos (CPF, Nome, CRM, etc.).

    Parâmetros:
        conteudo_bytes (bytes): Conteúdo binário bruto do arquivo enviado.
        nome_arquivo (str): Nome original do arquivo para identificação e logs.
        apenas_biomarcadores (bool): Se True (padrão), aplica a filtragem estrita de biomarcadores.

    Retorno:
        dict: Estrutura contendo o status da extração, texto purificado e alertas.
    """
    tamanho_bytes = len(conteudo_bytes) if conteudo_bytes else 0

    # 1. VALIDAÇÃO DE CONTEÚDO VAZIO
    if not conteudo_bytes or tamanho_bytes == 0:
        return {
            "sucesso": False,
            "mensagem": "O arquivo PDF enviado está vazio (0 bytes).",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": 0,
            "total_paginas": 0,
            "texto_extraido": "",
            "paginas": [],
            "alertas": ["Arquivo vazio ou não fornecido."]
        }

    # 2. VALIDAÇÃO DO LIMITE MÁXIMO DE TAMANHO
    if tamanho_bytes > LIMITE_TAMANHO_BYTES:
        tamanho_mb = round(tamanho_bytes / (1024 * 1024), 2)
        return {
            "sucesso": False,
            "mensagem": f"O arquivo excede o limite máximo permitido de 10 MB (tamanho atual: {tamanho_mb} MB).",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho_bytes,
            "total_paginas": 0,
            "texto_extraido": "",
            "paginas": [],
            "alertas": ["Arquivo ultrapassa o limite de tamanho."]
        }

    # 3. VALIDAÇÃO DO CABEÇALHO DO PDF (%PDF-)
    if not conteudo_bytes.startswith(b"%PDF-"):
        return {
            "sucesso": False,
            "mensagem": "O arquivo enviado não possui um cabeçalho válido de documento PDF.",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho_bytes,
            "total_paginas": 0,
            "texto_extraido": "",
            "paginas": [],
            "alertas": ["Formato de arquivo incompatível ou cabeçalho inválido."]
        }

    # 4. PROCESSAMENTO E LEITURA DO PDF EM MEMÓRIA RAM
    fluxo_memoria = io.BytesIO(conteudo_bytes)

    try:
        leitor = PdfReader(fluxo_memoria)

        # 5. TRATAMENTO DE PDF PROTEGIDO COM SENHA
        if leitor.is_encrypted:
            try:
                descriptografado = leitor.decrypt("")
                if descriptografado == 0:
                    return {
                        "sucesso": False,
                        "mensagem": "O arquivo PDF está protegido por senha e não pôde ser aberto.",
                        "nome_arquivo": nome_arquivo,
                        "tamanho_bytes": tamanho_bytes,
                        "total_paginas": len(leitor.pages) if hasattr(leitor, "pages") else 0,
                        "texto_extraido": "",
                        "paginas": [],
                        "alertas": ["Documento criptografado requer senha."]
                    }
            except Exception:
                return {
                    "sucesso": False,
                    "mensagem": "O arquivo PDF está protegido por senha e não pôde ser aberto.",
                    "nome_arquivo": nome_arquivo,
                    "tamanho_bytes": tamanho_bytes,
                    "total_paginas": 0,
                    "texto_extraido": "",
                    "paginas": [],
                    "alertas": ["Documento criptografado requer senha."]
                }

        total_paginas = len(leitor.pages)

        # 6. VERIFICAÇÃO SE O PDF POSSUI PÁGINAS
        if total_paginas == 0:
            return {
                "sucesso": False,
                "mensagem": "O documento PDF não contém páginas válidas.",
                "nome_arquivo": nome_arquivo,
                "tamanho_bytes": tamanho_bytes,
                "total_paginas": 0,
                "texto_extraido": "",
                "paginas": [],
                "alertas": ["Documento sem páginas."]
            }

        textos_paginas = []
        alertas = []
        texto_acumulado = []

        # 7. EXTRAÇÃO E PURIFICAÇÃO PÁGINA POR PÁGINA
        for indice, pagina in enumerate(leitor.pages):
            try:
                texto_pagina = pagina.extract_text() or ""
            except Exception as erro_pagina:
                texto_pagina = ""
                alertas.append(f"Aviso: Não foi possível extrair o texto da página {indice + 1}: {str(erro_pagina)}")

            if apenas_biomarcadores:
                # Aplica o corte de rodapé e o filtro estrito de biomarcadores
                linhas = texto_pagina.split("\n")
                linhas_clinicas = []
                for linha in linhas:
                    l = linha.strip()
                    if not l:
                        continue
                    if any(g.search(l) for g in GATILHOS_CORTE_BLOCO):
                        break
                    if any(p.search(l) for p in PADROES_LINHAS_PROIBIDAS):
                        continue
                    linhas_clinicas.append(l)

                texto_processado = "\n".join(linhas_clinicas)
                texto_processado = filtrar_apenas_biomarcadores(texto_processado)
            else:
                texto_processado = texto_pagina.strip()

            textos_paginas.append({
                "numero": indice + 1,
                "caracteres": len(texto_processado),
                "texto": texto_processado
            })

            if texto_processado:
                texto_acumulado.append(texto_processado)

        texto_total = "\n\n".join(texto_acumulado).strip()

        # 8. TRATAMENTO PARA DOCUMENTOS SEM CAMADA DE TEXTO
        if len(texto_total) == 0:
            aviso_sem_texto = (
                "Nenhum texto selecionável de biomarcador foi encontrado no documento processado. "
                "O exame pode ser uma imagem digitalizada (scan). "
                "Atenção: A ausência de texto extraível não deve ser interpretada como ausência de alterações laboratoriais."
            )
            alertas.append(aviso_sem_texto)

            print(f"[EXTRATOR PDF] Arquivo: {nome_arquivo} | Páginas: {total_paginas} | Aviso: Sem camada de texto.")

            return {
                "sucesso": True,
                "mensagem": "Documento processado, porém sem texto de biomarcadores identificável.",
                "nome_arquivo": nome_arquivo,
                "tamanho_bytes": tamanho_bytes,
                "total_paginas": total_paginas,
                "texto_extraido": "",
                "paginas": textos_paginas,
                "alertas": alertas
            }

        # LOG SEGURO: Apenas métricas quantitativas (sem expor texto ou dados médicos)
        print(f"[EXTRATOR PDF] Arquivo: {nome_arquivo} | Páginas: {total_paginas} | Biomarcadores extraídos: {len(texto_total)} caracteres.")

        return {
            "sucesso": True,
            "mensagem": f"Biomarcadores extraídos com sucesso de {total_paginas} página(s).",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho_bytes,
            "total_paginas": total_paginas,
            "texto_extraido": texto_total,
            "paginas": textos_paginas,
            "alertas": alertas
        }

    except PdfReadError as erro_leitura:
        return {
            "sucesso": False,
            "mensagem": f"Não foi possível ler o arquivo PDF. O documento pode estar corrompido ou mal formatado ({str(erro_leitura)}).",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho_bytes,
            "total_paginas": 0,
            "texto_extraido": "",
            "paginas": [],
            "alertas": ["Erro de leitura na estrutura interna do PDF."]
        }
    except Exception as erro_inesperado:
        return {
            "sucesso": False,
            "mensagem": f"Ocorreu um erro inesperado ao processar o PDF: {str(erro_inesperado)}",
            "nome_arquivo": nome_arquivo,
            "tamanho_bytes": tamanho_bytes,
            "total_paginas": 0,
            "texto_extraido": "",
            "paginas": [],
            "alertas": ["Falha inesperada no processamento."]
        }

