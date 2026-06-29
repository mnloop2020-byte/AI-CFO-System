import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())

// ======================
// HEALTH ROUTE
// ======================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// ======================
// ABOUT ROUTE
// ======================
app.get('/about', (req, res) => {
  res.json({
    project: 'AI CFO System',
    version: '1.0',
  })
})

export default app