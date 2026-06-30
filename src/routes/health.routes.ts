import { Router } from 'express'

const router = Router()

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
  })
})

router.get('/about', (req, res) => {
  res.json({
    project: 'AI CFO System',
    version: '1.0',
  })
})

export default router