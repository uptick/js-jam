import {createTransform} from 'redux-persist'

import DB from './db'
import Field from './field'
import {argopts, getDiffOp, getDiffType, isEmpty} from './utils'
import {executionTime} from './debug'

const jamTransform = schema => {
  return createTransform(

    (state, key) => {
      try {
        if (key != 'model' || !state.db)
          return state
        return {db: JSON.stringify(state.db.toJS())}
      } catch(e) {
        console.error(e)
        return state
      }
    },

    (state, key) => {
      try {
        if (key != 'model' || !state.db)
          return state
        const db = new DB(JSON.parse(state.db), {schema})
        return {
          ...state,
          db: db.data
        }
      } catch(e) {
        console.error(e)
        return state
      }
    }

  )
}

function serializeDBTail(db) {
  let data = {}
  const tail = db.data.get('tail')
  for (const [type, info] of tail) {
    const model = db.getModel(type)
    const objs = info.get('objects')
    data[type] = objs.map(r => model.fromRecord(r))
  }
  return JSON.stringify(data)
}

function serializeDBDiffs(db) {
  return JSON.stringify({
    'diffs': db.getDiffs2().map(diff => {
      const model = db.getModel(getDiffType(diff))
      let sDiff = {
        _op: getDiffOp(diff),
        _type: diff._type,
        id: diff.id
      }
      for (const [fldName, v] of Object.entries(diff)) {
        if (['id', '_type'].includes(fldName))
          continue
        const fldType = model.getFieldType(fldName)
        sDiff[fldName] = [
          (v[0] === undefined) ? undefined : Field.fromInternal(fldType, v[0]),
          (v[1] === undefined) ? undefined : Field.fromInternal(fldType, v[1])
        ]
      }
      return sDiff
    }).toJS(),
    'tailptr': db.data.get('tailptr')
  })
}

function deserializeDBTail(db, tailData) {
  if (isEmpty(tailData))
    return null
  tailData = JSON.parse(tailData)
  let data = {}
  for (const [type, objs] of Object.entries(tailData))
    data[type] = {'objects': objs}
  return data
}

function deserializeDBDiffs(db, diffsData) {
  if (isEmpty(diffsData))
    return null
  diffsData = JSON.parse(diffsData)
  return {
    'diffs': diffsData.diffs.map(sDiff => {
      const {_op, ...rest} = sDiff
      let ii
      if (_op == 'create')
        ii = 0
      else if(_op == 'remove')
        ii = 1
      const model = db.getModel(getDiffType(rest))
      let diff = {
        _type: sDiff._type,
        id: sDiff.id
      }
      for (const [fldName, v] of Object.entries(rest)) {
        if (!['id', '_type'].includes(fldName)) {
          const fldType = model.getFieldType(fldName)
          diff[fldName] = [
            Field.toInternal(fldType, v[0]),
            Field.toInternal(fldType, v[1])
          ]
        }
        if (ii !== undefined)
          diff[fldName][ii] = undefined
      }
      return diff
    }),
    'tailptr': diffsData.tailptr
  }
}

function deserializeDB(db, tailData, diffsData) {
  let tail = deserializeDBTail(db, tailData)
  let diffs = deserializeDBDiffs(db, diffsData)
  db.reset({tail, ...diffs})
  return db
}

function persistToLocalStorage(options) {
  console.debug('Persisting to local storage.')
  executionTime(() => {
    let [db, opts] = argopts(options, 'db', DB.isDB)
    if (opts.force || localStorage.getItem('jam|tail') == null)
      localStorage.setItem('jam|tail', serializeDBTail(db))
    localStorage.setItem('jam|diffs', serializeDBDiffs(db))
  })
}

function rehydrateFromLocalStorage(options) {
  console.debug('Rehydrating from local storage.')
  executionTime(() => {
    let [db, opts] = argopts(options, 'db', DB.isDB)
    return deserializeDB(db, localStorage.getItem('jam|tail'), localStorage.getItem('jam|diffs'))
  })
}

export default jamTransform

export {
  persistToLocalStorage,
  rehydrateFromLocalStorage
}
