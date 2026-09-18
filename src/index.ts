import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv";
import Fastify from "fastify";
import {jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider} from "fastify-type-provider-zod";
import z from "zod/v4";

dotenv.config();

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Bootcamp Treinos API",
      description: "API para o bootcamp de treinos",
      version: "1.0.0",
    },
    servers: [
      {
        description: "localhost",
        url: "http://localhost:8081",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Hello World",
    tags: ["hello"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: "Hello World",
    };
  },
});

const start = async () => {
  try {
    await app.listen({port: Number(process.env.PORT) || 8081});
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
