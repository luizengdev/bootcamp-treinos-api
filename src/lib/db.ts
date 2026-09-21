import {PrismaPg} from "@prisma/adapter-pg";

import {PrismaClient} from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({connectionString});

// Utiliza um "truque" com o objeto global para evitar que múltiplas instâncias do Prisma
// sejam criadas em ambientes de desenvolvimento.
const globalForPrisma = global as unknown as {prisma: PrismaClient};

// O client Prisma será reutilizado se já existir no global, senão ele cria uma nova instância passando o adaptador.
export const prisma = globalForPrisma.prisma || new PrismaClient({adapter});

// Se não estiver em produção, armazena a instância no objeto global. Em produção, cada instância de execução pode ser isolada.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
