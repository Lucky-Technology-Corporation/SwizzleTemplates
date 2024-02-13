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
//_SWIZZLE_FILE_PATH_backend/helpers/getPostgresDB.ts

import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING })

export default function getPostgresDB() {
  return pool
}
//_SWIZZLE_FILE_PATH_frontend/src/pages/SwizzleHomePage.tsx
import api from '../Api'
import { useEffect, useState } from 'react'
import SignIn from '../components/SignIn'

function Home() {
  const [postgresTablesResult, setPostgresTablesResult] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [tableData, setTableData] = useState(null)
  const [headers, setHeaders] = useState(null)

  useEffect(() => {
    api
      .get('/postgres/tables')
      .then((result) => {
        setPostgresTablesResult(result.data)
      })
      .catch((error) => {
        console.error(error.message)
      })
  }, [])

  useEffect(() => {
    if (!selectedTable) return

    api
      .get(`/postgres/${selectedTable}`, {
        params: {
          size: 10,
          page: 0,
        },
      })
      .then((result) => {
        setTableData(result.data)
        if (result.data.length > 0) {
          setHeaders(Object.keys(result.data[0]))
        } else {
          setHeaders(null)
        }
      })
      .catch((error) => {
        console.error(error.message)
      })
  }, [selectedTable])

  return (
    <div className="bg-gray-800 h-screen flex flex-col items-center text-gray-300">
      <SignIn />
      {/* Dropdown for selecting tables */}
      {postgresTablesResult.length > 0 && (
        <div className="mt-4 flex items-center gap-3 mx-4">
          <label
            htmlFor="table-select"
            className="text-sm font-medium text-gray-300"
          >
            Select a table:
          </label>
          <div className="flex-grow">
            <select
              id="table-select"
              className="bg-gray-700 border border-gray-600 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              onChange={(event) => setSelectedTable(event.target.value)}
            >
              {postgresTablesResult.map((table, index) => (
                <option key={index} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {tableData && headers && (
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((header, headerIndex) => (
                  <td
                    key={headerIndex}
                    className="px-5 py-2 border-b border-gray-700 bg-gray-800 text-sm"
                  >
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Home
