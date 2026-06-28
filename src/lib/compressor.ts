/**
 * Módulo utilitário para compressão e redimensionamento reativo de imagens no cliente.
 * Evita o upload de fotos excessivamente pesadas para o Supabase Storage, economizando banda e custos.
 */

/**
 * Comprime uma imagem utilizando a API de Canvas nativa do navegador.
 * Redimensiona a imagem para uma resolução máxima de 1280px (largura ou altura)
 * e aplica compressão JPEG com qualidade em 75%.
 *
 * @param arquivo O arquivo original (File) enviado no input
 * @returns Uma Promise contendo o arquivo resultante comprimido (File)
 */
export async function comprimirImagem(arquivo: File): Promise<File> {
  // Define o limite de ativação da compressão (1.8 MB em bytes)
  const LIMITE_BYTES = 1.8 * 1024 * 1024;
  
  // Se o arquivo for menor que o limite, ignora a compressão para poupar processamento
  if (arquivo.size <= LIMITE_BYTES) {
    console.log(`Imagem leve (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Pulando compressão.`);
    return arquivo;
  }

  console.log(`Imagem pesada detectada (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Iniciando compressão Canvas...`);

  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.readAsDataURL(arquivo);

    leitor.onload = (evento) => {
      const img = new Image();
      img.src = evento.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let largura = img.width;
        let altura = img.height;

        // Limite máximo de resolução de visualização técnica de manutenção
        const MAX_DIMENSAO = 1280;

        // Redimensiona proporcionalmente mantendo o aspect ratio
        if (largura > MAX_DIMENSAO || altura > MAX_DIMENSAO) {
          if (largura > altura) {
            altura = Math.round((altura * MAX_DIMENSAO) / largura);
            largura = MAX_DIMENSAO;
          } else {
            largura = Math.round((largura * MAX_DIMENSAO) / altura);
            altura = MAX_DIMENSAO;
          }
        }

        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro: Não foi possível obter o contexto 2D do Canvas."));
          return;
        }

        // Desenha a imagem no Canvas com o novo dimensionamento
        ctx.drawImage(img, 0, 0, largura, altura);

        // Converte o Canvas em um Blob formatado como JPEG (altamente comprimível) com 75% de qualidade
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Erro: Falha ao converter o Canvas em Blob."));
              return;
            }

            // Normaliza a extensão do nome do arquivo para .jpg
            const nomeComprimido = arquivo.name.replace(/\.[^/.]+$/, "") + ".jpg";

            // Cria o novo arquivo File pronto para envio
            const arquivoComprimido = new File([blob], nomeComprimido, {
              type: "image/jpeg",
              lastModified: Date.now()
            });

            console.log(`Compressão finalizada. Novo tamanho: ${(arquivoComprimido.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(arquivoComprimido);
          },
          "image/jpeg",
          0.75
        );
      };

      img.onerror = () => reject(new Error("Erro ao carregar os dados da imagem no elemento Image."));
    };

    leitor.onerror = () => reject(new Error("Erro na leitura do arquivo de mídia."));
  });
}

/**
 * Comprime e redimensiona uma imagem de logomarca corporativa,
 * preservando a nitidez e a transparência (para arquivos PNG).
 * Redimensiona para um limite máximo de 800px de largura/altura
 * e comprime arquivos acima de 2 MB de forma reativa.
 *
 * @param arquivo O arquivo original da logomarca (File)
 * @returns Promise com o arquivo comprimido resultante (File)
 */
export async function comprimirLogomarca(arquivo: File): Promise<File> {
  const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB
  const MAX_DIMENSAO = 800; // Limite ideal para marcas em proporção quadrada ou paisagem leve

  // Se for mais leve que 2 MB, mantém o original para preservar 100% da nitidez sem perdas
  if (arquivo.size <= LIMITE_BYTES) {
    console.log(`Logomarca dentro do limite de tamanho (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Mantendo original.`);
    return arquivo;
  }

  console.log(`Logomarca pesada detectada (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Iniciando compressão inteligente...`);

  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.readAsDataURL(arquivo);

    leitor.onload = (evento) => {
      const img = new Image();
      img.src = evento.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let largura = img.width;
        let altura = img.height;

        // Redimensiona proporcionalmente mantendo a proporção original
        if (largura > MAX_DIMENSAO || altura > MAX_DIMENSAO) {
          if (largura > altura) {
            altura = Math.round((altura * MAX_DIMENSAO) / largura);
            largura = MAX_DIMENSAO;
          } else {
            largura = Math.round((largura * MAX_DIMENSAO) / altura);
            altura = MAX_DIMENSAO;
          }
        }

        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro: Não foi possível obter o contexto 2D do Canvas."));
          return;
        }

        // Desenha a imagem no Canvas com as novas dimensões
        ctx.drawImage(img, 0, 0, largura, altura);

        // Identifica o tipo MIME correto para manter a transparência de PNGs
        const tipoMime = arquivo.type || "image/png";
        
        // Define qualidade: 85% para JPEG, PNG não possui parâmetro de qualidade nativo no toBlob
        const qualidade = tipoMime === "image/png" ? undefined : 0.85;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Erro: Falha ao converter Canvas em Blob."));
              return;
            }

            // Normaliza a extensão com base no tipo
            let extensao = ".png";
            if (tipoMime.includes("jpeg") || tipoMime.includes("jpg")) {
              extensao = ".jpg";
            }

            const nomeComprimido = arquivo.name.replace(/\.[^/.]+$/, "") + "_comprimido" + extensao;

            const arquivoComprimido = new File([blob], nomeComprimido, {
              type: tipoMime,
              lastModified: Date.now()
            });

            console.log(`Compressão de logomarca finalizada. Novo tamanho: ${(arquivoComprimido.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(arquivoComprimido);
          },
          tipoMime,
          qualidade
        );
      };

      img.onerror = () => reject(new Error("Erro ao carregar os dados da logomarca no Canvas."));
    };

    leitor.onerror = () => reject(new Error("Erro na leitura do arquivo da logomarca."));
  });
}

/**
 * Comprime e redimensiona uma imagem de evidência de chamado (problema ou solução),
 * limitando-a a no máximo 1200px (largura ou altura) caso seu tamanho passe de 2 MB.
 *
 * @param arquivo O arquivo original (File)
 * @returns Promise com o arquivo comprimido resultante (File)
 */
export async function comprimirImagemChamado(arquivo: File): Promise<File> {
  const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB
  const MAX_DIMENSAO = 1200; // Limite máximo solicitado de 1200px

  // Se for mais leve que 2 MB, mantém o original para preservar a integridade
  if (arquivo.size <= LIMITE_BYTES) {
    console.log(`Imagem de chamado dentro do limite (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Pulando compressão.`);
    return arquivo;
  }

  console.log(`Imagem de chamado pesada detectada (${(arquivo.size / 1024 / 1024).toFixed(2)}MB). Iniciando compressão Canvas (máx 1200px)...`);

  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.readAsDataURL(arquivo);

    leitor.onload = (evento) => {
      const img = new Image();
      img.src = evento.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let largura = img.width;
        let altura = img.height;

        // Redimensiona proporcionalmente mantendo a proporção original
        if (largura > MAX_DIMENSAO || altura > MAX_DIMENSAO) {
          if (largura > altura) {
            altura = Math.round((altura * MAX_DIMENSAO) / largura);
            largura = MAX_DIMENSAO;
          } else {
            largura = Math.round((largura * MAX_DIMENSAO) / altura);
            altura = MAX_DIMENSAO;
          }
        }

        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro: Não foi possível obter o contexto 2D do Canvas."));
          return;
        }

        // Desenha a imagem no Canvas com as novas dimensões
        ctx.drawImage(img, 0, 0, largura, altura);

        const tipoMime = arquivo.type || "image/jpeg";
        const qualidade = tipoMime === "image/png" ? undefined : 0.75;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Erro: Falha ao converter Canvas em Blob."));
              return;
            }

            let extensao = ".jpg";
            if (tipoMime.includes("png")) {
              extensao = ".png";
            }

            const nomeComprimido = arquivo.name.replace(/\.[^/.]+$/, "") + "_chamado" + extensao;

            const arquivoComprimido = new File([blob], nomeComprimido, {
              type: tipoMime,
              lastModified: Date.now()
            });

            console.log(`Compressão de chamado finalizada. Novo tamanho: ${(arquivoComprimido.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(arquivoComprimido);
          },
          tipoMime,
          qualidade
        );
      };

      img.onerror = () => reject(new Error("Erro ao carregar os dados da imagem no Canvas."));
    };

    leitor.onerror = () => reject(new Error("Erro na leitura do arquivo de imagem."));
  });
}


