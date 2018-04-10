import {schema, getMovieData} from './movie-fixture'

const data = getMovieData()

const db = schema.db()
db.loadJsonApi(data)

export {
  schema,
  data,
  db
}
