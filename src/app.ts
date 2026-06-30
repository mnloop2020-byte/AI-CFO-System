import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/health.routes.js'
import chatRoute from './routes/chat.routes.js';

const app = express()

app.use(cors())
app.use(express.json())
app.use(chatRoute)

app.use(healthRoutes)

export default app