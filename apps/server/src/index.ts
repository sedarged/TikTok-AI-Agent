import express from 'express';
import cors from 'cors';
import { env } from './env';
import { router } from './routes';
import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static artifacts
app.use('/artifacts', express.static(env.ARTIFACTS_DIR));

app.use('/api', router);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
