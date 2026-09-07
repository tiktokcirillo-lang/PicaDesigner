import 'dotenv/config';
import express from 'express';
import {loadOpenAIConfig} from '../infrastructure/ai/providers/openai/config';
import {createVisualForensicsRouter} from './api/visual-forensics';

const config = loadOpenAIConfig();
const app = express();
app.use(express.json({limit: `${config.maxImageMb + 1}mb`}));
app.use('/api/visual-forensics', createVisualForensicsRouter());
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`PicaDesigner server listening on http://localhost:${port}`));
