import { createApplication } from './application';
async function bootstrap() {
 const app = await createApplication();
 await app.listen(Number(process.env.PORT ?? 3000), process.env.NODE_ENV === 'test' ? '127.0.0.1' : (process.env.LISTEN_HOST || '0.0.0.0'));
}
void bootstrap();
