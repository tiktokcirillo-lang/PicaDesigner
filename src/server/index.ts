import 'dotenv/config';
import {createServerApp} from './app';

const app = createServerApp();
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`PicaDesigner server listening on http://localhost:${port}`));
