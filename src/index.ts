import dotenv from "dotenv";
import Fastify from "fastify";
import {serializerCompiler, validatorCompiler, ZodTypeProvider} from "fastify-type-provider-zod";
import z from "zod/v4";

dotenv.config();

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

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
