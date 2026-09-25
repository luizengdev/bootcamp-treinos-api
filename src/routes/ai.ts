import {google} from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
  TypeValidationError,
  validateUIMessages,
} from "ai";
import {fromNodeHeaders} from "better-auth/node";
import {FastifyInstance} from "fastify";
import {ZodTypeProvider} from "fastify-type-provider-zod";
import z from "zod";

import {WeekDay} from "../generated/prisma/enums.js";
import {auth} from "../lib/auth.js";
import {AiChatSchema, ErrorSchema} from "../schemas/index.js";
import {CreateWorkoutPlan} from "../usecases/CreateWorkoutPlan.js";
import {GetUserTrainData} from "../usecases/GetUserTrainData.js";
import {ListWorkoutPlans} from "../usecases/ListWorkoutPlans.js";
import {UpsertUserTrainData} from "../usecases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `Você é um personal trainer virtual, especialista em montar planos de treino de musculação.

## Tom e estilo
- Seja amigável, motivador e use linguagem simples, sem jargões técnicos. A maioria das pessoas com quem você fala é leiga em musculação.
- Dê respostas curtas e objetivas.

## Fluxo obrigatório
1. SEMPRE chame a tool \`getUserTrainData\` antes de qualquer interação com o usuário.
2. Se ela retornar null (usuário sem dados cadastrados):
   - Pergunte, em uma única mensagem e de forma simples e direta: nome, peso (kg), altura (cm), idade e % de gordura corporal.
   - Depois de receber as respostas, salve com a tool \`updateUserTrainData\`. Converta o peso de kg para gramas (kg × 1000). A % de gordura é um número inteiro onde 100 representa 100%.
3. Se o usuário já tem dados cadastrados: cumprimente-o pelo nome (\`userName\`).

## Criação de plano de treino
- Antes de montar o plano, pergunte apenas: objetivo, quantos dias por semana ele tem disponíveis e se tem alguma restrição física ou lesão. Poucas perguntas, simples e diretas.
- Use a tool \`getWorkoutPlans\` se precisar consultar os planos que o usuário já tem.
- Crie o plano com a tool \`createWorkoutPlan\`.
- O plano DEVE ter exatamente 7 dias, de MONDAY a SUNDAY, um para cada dia da semana.
- Dias sem treino: \`isRest: true\`, \`exercises: []\` e \`estimatedDurationInSeconds: 0\`.

### Divisão do treino (split) conforme os dias disponíveis
- 2 a 3 dias/semana: Full Body ou ABC (A: Peito + Tríceps, B: Costas + Bíceps, C: Pernas + Ombros).
- 4 dias/semana: Upper/Lower (recomendado, cada grupo 2x por semana) ou ABCD (A: Peito + Tríceps, B: Costas + Bíceps, C: Pernas, D: Ombros + Abdômen).
- 5 dias/semana: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x por semana).
- 6 dias/semana: PPL 2x — Push/Pull/Legs repetido.

### Princípios de montagem
- Treine músculos sinérgicos juntos (peito + tríceps, costas + bíceps).
- Exercícios compostos primeiro, isoladores depois.
- De 4 a 8 exercícios por sessão.
- De 3 a 4 séries por exercício. 8 a 12 repetições para hipertrofia, 4 a 6 para força.
- Descanso entre séries: 60 a 90s (hipertrofia), 2 a 3 min (compostos pesados).
- Evite treinar o mesmo grupo muscular em dias consecutivos.
- Dê nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso").

### Imagem de capa (coverImageUrl)
SEMPRE forneça um \`coverImageUrl\` para cada dia, escolhido pelo foco muscular do dia:
- Dias majoritariamente superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
  - https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
  - https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL
- Dias majoritariamente inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
  - https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
  - https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY
- Alterne entre as duas opções de cada categoria para variar.
- Dias de descanso usam uma imagem de superior.`;

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat with AI personal trainer",
      body: AiChatSchema,
      response: {
        200: z.unknown().describe("UI message stream (Server-Sent Events)"),
        400: ErrorSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({error: "Unauthorized", code: "UNAUTHORIZED"});
        }
        const userId = session.user.id;

        const messages = await validateUIMessages({
          messages: request.body.messages,
        });
        const result = streamText({
          model: google("gemini-3.6-flash"),
          instructions: SYSTEM_PROMPT,
          stopWhen: stepCountIs(10),
          tools: {
            getUserTrainData: tool({
              description:
                "Busca os dados de treino do usuário autenticado (nome, peso, altura, idade e % de gordura). Retorna null se o usuário ainda não tiver dados cadastrados.",
              inputSchema: z.object({}),
              execute: async () => {
                const getUserTrainData = new GetUserTrainData();
                return getUserTrainData.execute({userId});
              },
            }),
            updateUserTrainData: tool({
              description: "Cria ou atualiza os dados de treino do usuário autenticado.",
              inputSchema: z.object({
                weightInGrams: z.number().int().positive().describe("Peso em gramas (converter de kg: kg × 1000)"),
                heightInCentimeters: z.number().int().positive().describe("Altura em centímetros"),
                age: z.number().int().positive().describe("Idade em anos"),
                bodyFatPercentage: z
                  .number()
                  .int()
                  .min(0)
                  .max(100)
                  .describe("Percentual de gordura corporal, inteiro de 0 a 100 (100 representa 100%)"),
              }),
              execute: async (input) => {
                const upsertUserTrainData = new UpsertUserTrainData();
                return upsertUserTrainData.execute({userId, ...input});
              },
            }),
            getWorkoutPlans: tool({
              description: "Lista os planos de treino do usuário autenticado, com seus dias e exercícios.",
              inputSchema: z.object({}),
              execute: async () => {
                const listWorkoutPlans = new ListWorkoutPlans();
                return listWorkoutPlans.execute({userId});
              },
            }),
            createWorkoutPlan: tool({
              description: "Cria um novo plano de treino completo para o usuário.",
              inputSchema: z.object({
                name: z.string().describe("Nome do plano de treino"),
                workoutDays: z
                  .array(
                    z.object({
                      name: z.string().describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                      weekDay: z.enum(WeekDay).describe("Dia da semana"),
                      isRest: z.boolean().describe("Se é dia de descanso (true) ou treino (false)"),
                      estimatedDurationInSeconds: z
                        .number()
                        .describe("Duração estimada em segundos (0 para dias de descanso)"),
                      coverImageUrl: z
                        .string()
                        .url()
                        .describe(
                          "URL da imagem de capa do dia de treino. Usar as URLs de superior ou inferior conforme o foco muscular do dia.",
                        ),
                      exercises: z
                        .array(
                          z.object({
                            order: z.number().describe("Ordem do exercício no dia"),
                            name: z.string().describe("Nome do exercício"),
                            sets: z.number().describe("Número de séries"),
                            reps: z.number().describe("Número de repetições"),
                            restTimeInSeconds: z.number().describe("Tempo de descanso entre séries em segundos"),
                          }),
                        )
                        .describe("Lista de exercícios (vazia para dias de descanso)"),
                    }),
                  )
                  .length(7)
                  .describe("Array com exatamente 7 dias de treino (MONDAY a SUNDAY)"),
              }),
              execute: async (input) => {
                const createWorkoutPlan = new CreateWorkoutPlan();
                return createWorkoutPlan.execute({
                  userId,
                  name: input.name,
                  workoutDays: input.workoutDays,
                });
              },
            }),
          },
          messages: await convertToModelMessages(messages),
        });
        const response = createUIMessageStreamResponse({
          stream: toUIMessageStream({stream: result.stream}),
        });
        response.headers.forEach((value, key) => reply.header(key, value));
        return reply.send(response.body);
      } catch (error) {
        app.log.error(error);
        if (error instanceof TypeValidationError) {
          return reply.status(400).send({
            error: "Invalid messages",
            code: "INVALID_MESSAGES",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
