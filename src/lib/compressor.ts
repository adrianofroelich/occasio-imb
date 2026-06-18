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
