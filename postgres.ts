//_SWIZZLE_FILE_PATH_backend/user-dependencies/get.postgres.(table).ts
import express, { Response } from 'express'
import { AuthenticatedRequest, requiredAuthentication, db } from 'swizzle-js'
import getPostgresDB from '../helpers/getPostgresDB.js'
const router = express.Router()

router.get('/postgres/:table', requiredAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  const { table } = request.params
  let query = `SELECT * FROM "${table}"`
  let queryParams = []

  const page = parseInt(request.query.page as string, 10)
  const size = parseInt(request.query.size as string, 10)

  const sortBy = request.query.sort_by as string
  const sortOrder = request.query.sort_order ? (request.query.sort_order as string).toLowerCase() : null

  if (!isNaN(page)) {
    if (page < 0) {
      return response.status(400).json({ error: `Page number must be greater than or equal to 0` })
    }
  } else if (isNaN(page) && request.query.page !== undefined) {
    return response.status(400).json({ error: `Page number must be a number` })
  }

  if (!isNaN(size)) {
    if (size < 1) {
      return response.status(400).json({ error: `Page size must be greater than or equal to 1` })
    }
  } else if (isNaN(size) && request.query.size !== undefined) {
    return response.status(400).json({ error: `Size must be a number` })
  }

  if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
    return response.status(400).json({ error: `Sort order must be either 'asc' or 'desc'` })
  }

  const limit = !isNaN(size) ? size : undefined
  const offset = !isNaN(page) && !isNaN(size) ? page * size : undefined

  if (sortBy) {
    query += ` ORDER BY "${sortBy}"`
    if (sortOrder) {
      query += ` ${sortOrder.toUpperCase()}`
    }
  }

  if (limit !== undefined && offset !== undefined) {
    queryParams.push(limit)
    query += ` LIMIT $${queryParams.length}`
    queryParams.push(offset)
    query += ` OFFSET $${queryParams.length}`
  }

  console.log(`Query: ${query}`)
  console.log(`Params: ${queryParams}`)

  try {
    const queryResult = await getPostgresDB().query(query, queryParams)
    return response.status(200).json(queryResult.rows)
  } catch (error) {
    if (error.code === '42P01') {
      return response.status(404).json({ error: `Table '${table}' not found` })
    } else if (error.code === '42703') {
      return response.status(400).json({ error: `No column '${sortBy}' found for table '${table}'` })
    }
    console.log(JSON.stringify(error))
    return response.status(500).json({ error: 'Something went wrong' })
  }
})

export default router
//_SWIZZLE_FILE_PATH_backend/user-dependencies/get.postgres.tables.ts
import express, { Response } from 'express'
import { AuthenticatedRequest, db, requiredAuthentication } from 'swizzle-js'
import getPostgresDB from '../helpers/getPostgresDB.js'
const router = express.Router()

router.get('/postgres/tables', requiredAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      AND table_type = 'BASE TABLE'
    `

    const queryResult = await getPostgresDB().query(query)
    return response.status(200).json(queryResult.rows.map(row => row.table_name))
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Something went wrong' })
  }
})

export default router
