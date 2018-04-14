import {bindActionCreators} from 'redux'
import uuid from 'uuid'
import {fromJS, Record, List, Map, OrderedMap, Set, OrderedSet} from 'immutable'

import Table from './table'
import Instance from './instance'
import {Filter} from './filter'
import {toArray, makeId, getDiffOp, getDiffId, isObject, isIterable,
        toList, Rollback, ModelError, splitJsonApiResponse, saveJson, loadJson,
        isArray, isNil, isEmpty, isRecord, getDiffType} from './utils'
import {toID} from './utils'
import {executionTime} from './debug'
import * as modelActions from './actions'

export default class DB {

  static Rollback = Rollback

  static isDB(value) {
    return value instanceof DB
  }

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor(data, options = {}) {
    this.schema = options.schema
    this.policy = (this.schema && this.schema.policy) || options.policy || 'remoteOnly'
    if (Map.isMap(data))
      this.data = data
    else
      this.reset(data)
  }

  reset(data) {
    this.data = fromJS({
      head: {},
      tail: {},
      ids: {},
      diffs: [],
      tailptr: 0,
      transactions: {},  // TODO: Deprecate.
      loads: [],  // TODO: Deprecate.
      objectLoads: []  // TODO: Deprecate
    })
    if (data) {
      if (data.tail) {
        Object.keys(data.tail).forEach(type => {
          let tbl = new Table(type, {data: data.tail[type], db: this})
          this.data = this.data.setIn(['tail', type], tbl.data)
        })
      }
      this.resetDiffs(data.diffs)
      this.resetIDs(data.ids)
      this.data = this.data.set('tailptr', data.tailptr || 0)
      this.resetIndices('tail')
      this.resetHead()
    }
  }

  resetDiffs(data) {
    this.data = this.data.set(
      'diffs',
      new List((data || []).map(diff => {
        const type = getDiffType(diff)
        const model = this.getModel(type)
        for (const [fldName, val] of Object.entries(diff)) {
          if (fldName != '_type') {
            diff[fldName] = [
              model.toInternal(fldName, val[0]),
              model.toInternal(fldName, val[1])
            ]
          }
          else
            diff[fldName] = val
        }
        return diff
      }))
    )
  }

  resetIDs(data) {
    if (data) {
      // TODO: This seems slow and annoying. It'll only happen once
      //  during a rehydrate, but still. The reason for it is that
      //  JS maps store keys as strings, but I'm using integers for
      //  ids.
      for (const [type, ids] of Object.entries(data)) {
        this.data = this.data.setIn(
          ['ids', type],
          new Map(Object.keys(ids).map(x => [toID(x), toID(ids[x])]))
        )
      }
    }
  }

  resetHead() {
    this.data = this.data.set('head', this.data.get('tail'))
    const tp = this.data.get('tailptr')
    for (const diff of this.data.get('diffs').slice(tp))
      this.applyDiff(diff)
  }

  resetIndices(branch = 'head') {
    for (const tbl of this.iterTables(branch)) {
      tbl.resetIndices()
      this.saveTable(tbl, branch)
    }
  }

  equals(other) {
    // TODO: Store diffs as immutable. Ugh, this is baaaad.
    return this.data
               .update('diffs', x => fromJS(x.toJS()))
               .equals(other.data.update('diffs', x => fromJS(x.toJS())))
  }

  copy() {
    return new DB(
      this.data, {
        policy: this.policy,
        schema: this.schema
      })
  }

  rebase(base, offset = 0) {
    const db = base.copy()
    let diffs = this.getLocalDiffs()
    if (offset)
      diffs = diffs.slice(offset)
    db.data = db.data.update('diffs', x => x.concat(diffs))
    db.resetHead()
    return db
  }

  /**
   * Clear the database in preparation for new data.
   */
  clear() {

    // Build a set of all outgoing IDs. We don't want to remove any
    // objects that still have outgoing diffs.
    let outgoing = this.data.get('diffs')
                       .filter(
                         diff =>
                           getDiffOp(diff) != 'remove'
                       )
                       .map(
                         diff =>
                           this.get(getDiffId(diff))
                       )

    // Clear head and tail.
    this.data = this.data
                    .set('head', new Map())
                    .set('tail', new Map())

    // Re-insert the outgoing objects.
    outgoing.forEach(
      obj => {
        let tbl = this.getTable(obj._type, 'tail')
        tbl.set(obj)
        this.saveTable(tbl, 'tail')
      }
    )
    this.data = this.data.set('head', this.data.get('tail'))
  }

  /**
   * Load models from JSON API format.
   */
  loadJsonApi(response) {
    if (!isIterable(response))
      response = [response]

    // Assemble the responses into sets of split objects.
    let splitObjectsSet = response.map(
      resp =>
        splitJsonApiResponse(resp)
    )

    this.loadSplitObjectsSet(splitObjectsSet)
  }

  /**
   * Load a set of objects into the DB.
   */
  loadObjects( objects ) {
    if( !isIterable( objects ) ) {
      objects = [objects]
    }

    let splitObjects = {}
    for( const obj of objects ) {
      if( !(obj._type in splitObjects) )
        splitObjects[obj._type] = []
      splitObjects[obj._type].push( obj )
    }

    this.loadSplitObjectsSet( splitObjects )
  }

  getLocalDiffs() {
    const tp = this.data.get('tailptr')
    return this.data.get('diffs').slice(tp)
  }

  getOutgoingDiffs() {
    const tp = this.data.get('tailptr')
    return this.data.get('diffs').slice(0, tp)
  }

  getIDTable(type) {
    // TODO: Should ensure `ids` entry always exists in table.
    return this.data.getIn(['ids', type], new Map())
  }

  mapID(type, id) {
    return this.getIDTable(type).get(id, id)
  }

  unmapID(type, id) {
    // TODO: Efficiency is baaaad with this one.
    let r = this.getIDTable(type).findKey(x => x == id)
    if (r === undefined)
      r = id
    return r
  }

  loadSplitObjectsSet( splitObjectsSet ) {
    splitObjectsSet = toList(splitObjectsSet)

    // Unapply my outgoing diffs to make sure we don't duplicate
    // the diffs. This must be done in reverse.
    for (const diff of this.getOutgoingDiffs().reverse())
      this.applyDiff(diff, true, 'tail')

    // Load all reponse objects.
    for (const splitObjects of splitObjectsSet) {

      // Now update the head data state to reflect the new server
      // information.
      Object.keys(splitObjects).forEach(type => {

        // Skip any tables we don't have a model type for.
        let tbl
        try {
          tbl = this.getTable( type, 'tail' )
        }
        catch (e) {
          // TODO: Catch specific type for missing model.
          console.warn(e)
          return
        }

        splitObjects[type].map(obj =>
          tbl.set(obj)
        )
        this.saveTable(tbl, 'tail')
      })
    }

    // Recalculate reverse-related fields.
    this._updateReverseRelationships( 'tail' )

    // Replay outgoing diffs onto tail. This is to match the expectation
    // that outgoing diffs will be applied to the server.
    for (const diff of this.getOutgoingDiffs())
      this.applyDiff(diff, false, 'tail')

    // Replace head with tail.
    this.data = this.data.set('head', this.data.get('tail'))

    // Replay local diffs onto head.
    for (const diff of this.getLocalDiffs())
      this.applyDiff(diff)
  }

  _updateReverseRelationships(branch = 'head') {
    this._clearReverseRelationships(branch)
    this.data.get(branch).forEach((tblData, type) => {
      let tbl = this.getTable(type, branch)
      tbl.model.relationships.forEach((relInfo, field) => {
        const relName = relInfo.get('relatedName')
        if(relInfo.get('reverse') || !relName)
          return
        tbl.data.get('objects').forEach(obj => {

          // `obj` can be null if we've removed some objects.
          if( obj === null )
            return

          for (const rel of tbl.iterRelated(obj.id, field)) {
            let relTbl
            try {
              relTbl = this.getTable(rel._type, branch)
            }
            catch(e) {
              console.warn(`Unable to find related type "${rel._type}", from "${tbl.type}.${field}"`)
              continue
            }

            const relObj = relTbl.get(rel.id)
            if (relObj !== undefined) {
              if (!tbl.model.fieldIsForeignKey(relName))
                relTbl.addRelationship(rel.id, relName, makeId(obj))
              else
                relTbl.set(relTbl.get(rel.id).set(relName, makeId(obj)))
            }
            this.saveTable(relTbl, branch)
          }
        })
      })
    })
  }

  _clearReverseRelationships(branch = 'head') {
    this.data.get(branch).forEach((tblData, type) => {
      let tbl = this.getTable(type, branch)
      tbl.model.relationships.forEach((relInfo, field) => {
        if(!relInfo.get('reverse'))
          return
        tbl.data.get('objects').forEach(obj => {
          if( obj === null )
            return
          // TODO: Only worrying about many-related.
          tbl.set(obj.set(field, new OrderedSet()))
        })
      })
      this.saveTable(tbl, branch)
    })
  }

  makeId(typeOrObject, id) {
    return makeId(typeOrObject, id)
  }

  getModel(type, fail = false) {
    return this.schema.getModel(type, fail)
  }

  getTable( type, branch = 'head' ) {
    const data = this.data.getIn( [branch, type] )
    return new Table( type, {data, db: this} )
  }

  *iterTables(branch = 'head') {
    for (const [type, data] of this.data.get(branch))
      yield new Table(type, {data, db: this})
  }

  saveTable( table, branch = 'head' ) {
    this.data = this.data.setIn( [branch, table.type], table.data );
  }

  toData(data) {
    return this.schema.toData(data, this)
  }

  toObject(data) { 
    return this.schema.toObject(data, this)
  }

  toObjects( data ) {
    return this.schema.toObjects(data, this)
  }

  getInstance(typeOrQuery, idOrQuery) {

    // Don't flip out if the model doesn't exist.
    let obj
    try {
      obj = this.get(typeOrQuery, idOrQuery)
    }
    catch(e) {
      // TODO: Catch specific error.
      console.warn(e)
      return undefined
    }

    if (obj === undefined)
      throw new ModelError(`Failed to find object: ${typeOrQuery._type}, ${typeOrQuery.id}`)
    // TODO: Should be using `obj` from above here or what?!
    return this.schema.toInstance(
      this.get(typeOrQuery, idOrQuery),
      this
    );
  }

  exists(id, branch='head') {
    return this.getTable( id._type, branch ).get( id.id ) !== undefined;
  }

  filter(type, filter, options) {
    return this.getTable(type).filter(filter)
  }

  _sort(results, fields) {
    fields = toArray(fields)
    return results.sort((a, b) => {
      for (let f of fields) {
        const d = (f[0] === '-') ? -1 : 1
        const av = this.lookupFirstValue(a, f)
        const bv = this.lookupFirstValue(b, f)
        if(av < bv) return -d
        if(av > bv) return d
      }
      return 0
    })
  }

  * lookup(record, field) {
    const _iter = function * (rec, flds) {
      if (!rec)
        return
      rec = this.get(rec)
      if (!rec)
        return
      const f = flds[0]
      if (flds.length > 1) {
        const model = this.getModel(rec._type)
        if (model.fieldIsForeignKey(f)) {
          for (const r of _iter(rec[f], flds.slice(1))) {
            yield r
          }
        }
        else if (model.fieldIsManyToMany(f)) {
          for (const n of rec[f])
            for (const r of _iter(n, flds.slice(1))) {
              yield r
            }
        }
        else
          throw new ModelError(`Cannot lookup non-related field.`)
      }
      else {
        yield [rec, f]
      }
    }.bind(this)

    if (!isArray(field))
      field = field.split('__')
    for (const r of _iter(record, field)) {
      yield r
    }
  }

  lookupFirstValue(record, field) {
    for (const r of this.lookup(record, field))
      return r[0][r[1]]
    return null
  }

  query(options) {
    const {policy = this.policy, json = false, ...other} = options
    let result
    if (policy == 'remoteOnly')
      result = this.remoteQuery({...other, json})
    else if (policy == 'local' && !json)
      result = this.localQuery(other)
    else {
      result = this.remoteQuery({...other, json})
      if (!json)
        result = result.then(() => this.localQuery(other))
    }
    return result
  }

  async remoteQuery(options) {
    console.debug('Running remote query.')
    const {
      type,
      id,
      operation = 'list',
      filter,
      sort,
      returnType = 'instance',
      json = false,
      ...other
    } = options

    // Retrieve the appropriate operation to perform. Defaults to
    // "list".
    const model = this.getModel(type)
    const op = model.ops[operation]
    if (!op)
      throw new ModelError(`Unknown operation ${operation} on ${type}.`)

    // Call the operation.
    const opts = {filter: Filter.toBasic(filter), sort, ...other}
    let jsonData
    if (!isEmpty(id))
      jsonData = await op(id, opts)
    else
      jsonData = await op(opts)
    if (json)
      return jsonData

    // Load the result into the DB and map IDs.
    // TODO: This is an efficiency problem. The load is done once here, then
    //  again in the saga.
    this.loadJsonApi(jsonData)
    let result
    if (Array.isArray(jsonData.data)) {
      result = jsonData.data.map(x => makeId(x.type, x.id))
      if (returnType === 'instance')
        result = result.map(x => this.getInstance(x))
      result = new List(result)
    }
    else {
      result = makeId(jsonData.data.type, jsonData.data.id)
      if (returnType == 'instance')
        result = this.getInstance(result)
    }

    return result
  }

  localQuery(options) {
    console.log('Running local query.')
    const {type, filter, sort, ...other} = options
    let results = this.filter(type, filter, other)
    if (sort)
      results = this._sort(results, sort)
    results = results.map(x => this.schema.toInstance(x, this))
    return results
  }

  /**
   * get( object )
   * get( {_type:, id:}
   * get( '', 3 )
   * get( '', {key: } )
   */
  get(iidOrType, id) {
    const iid = makeId(iidOrType, id)
    if (!iid)
      return null
    return this.getTable(iid._type).get(iid.id)
    /* let query, type
     * if (isEmpty(idOrQuery)) {
     *   if (isEmpty(typeOrQuery))
     *     return
     *   type = typeOrQuery._type
     *   if (Instance.isInstance(typeOrQuery) || isRecord(typeOrQuery))
     *     query = {id: typeOrQuery.id}
     *   else {
     *     const {_type: x, ...y} = typeOrQuery
     *     query = y
     *   }
     * }
     * else if (isObject(idOrQuery)) {
     *   type = typeOrQuery
     *   query = idOrQuery
     * }
     * else {
     *   type = typeOrQuery
     *   query = {id: idOrQuery}
     * }
     * return this.getTable(type).get(query) */
  }

  getOrCreate( type, query, values ) {
    let obj = this.get( type, query );
    if( !obj ) {
      const id = this.create({
        _type: type,
        ...query,
        ...values
      });
      obj = this.get( id );
      return [obj, true];
    }
    else {
      const model = this.getModel( type );
      obj = model.update( obj, values );
      this.update( obj );
      return [obj, false];
    }
  }

  getDiffs2() {
    return this.data.get('diffs')
  }

  getOutgoingDiffs() {
    return this.getDiffs2().slice(0, this.data.get('tailptr'))
  }

  getTailPointer() {
    return this.data.get('tailptr')
  }

  // TODO: Rename to "makeDiffs"
  getDiffs() {
    let diffs = []
    let tbl = this._makeDependencyTable()
    let id = this._getNextReady(tbl)
    while(id) {
      if (tbl[id].optional.size > 0) {
        const [mainDiff, auxDiff] = this._splitDiff(tbl[id])
        diffs.push(mainDiff)
        tbl[id].diff = auxDiff
        tbl[id].required = tbl[id].optional
        tbl[id].optional = new Set()
      }
      else {
        diffs.push(tbl[id].diff)
        delete tbl[id]
      }
      id = this._getNextReady(tbl)
    }

    // Add removals.
    this.schema.models.map((model, type) => {
      const headTbl = this.getTable(model.type, 'head')
      const tailTbl = this.getTable(model.type, 'tail')
      for (const tailObj of tailTbl.iterObjects()) {
        const headObj = headTbl.get(tailObj.id)
        if( headObj )  // ony want removals
          continue
        const diff = model.diff(tailObj, headObj)
        if (!diff)  // can this even happen?
          continue
        diffs.push(diff)
      }
    })

    return diffs
  }

  _splitDiff(info) {
    const {diff, optional} = info
    let auxDiff = {}
    const model = this.getModel(diff._type[1])
    for (const fieldName of model.iterRelationships()) {
      if (!(fieldName in diff))
        continue
      const field = model.getField(fieldName)
      if (field.get('many')) {
        auxDiff[fieldName] = [
          (diff[fieldName][0] || []).filter(x => !optional.has(x)),
          (diff[fieldName][1] || []).filter(x => !optional.has(x))
        ]
        diff[fieldName] = [
          (diff[fieldName][0] || []).filter(x => optional.has(x)),
          (diff[fieldName][1] || []).filter(x => optional.has(x))
        ]
      }
      else {
        //        if (!isEmpty(diff[fieldName][1]) {
        if (optional.has(diff[fieldName][1])) {
          auxDiff[fieldName] = diff[fieldName]
          delete diff[fieldName]
        }
      }
    }
    return [diff, auxDiff]
  }

  _makeDependencyTable() {
    let tbl = {}
    this.schema.models.map((model, type) => {
      const headTbl = this.getTable(model.type, 'head')
      const tailTbl = this.getTable(model.type, 'tail')
      for (const headObj of headTbl.iterObjects()) {
        const tailObj = tailTbl.get(headObj.id)
        const diff = model.diff(tailObj, headObj)
        if (!diff)
          continue
        const id = makeId(headObj)
        const tblId = `${id._type}|${id.id}`
        tbl[tblId] = {
          id: id,
          diff,
          required: new Set(),
          optional: new Set()
        }
        for (const fieldName of model.iterRelationships()) {
          const field = model.getField(fieldName)
          if (diff[fieldName] === undefined)
            continue
          let related = diff[fieldName][1]
          if (isEmpty(related))
            continue
          if (!field.get('many'))
            related = [related]
          let kind = field.get('required') ? 'required' : 'optional'
          for (const relId of related) {
            // TODO: Why would relId be null?
            if (isEmpty(relId) || this.exists(relId, 'tail'))
              continue
            tbl[tblId][kind] = tbl[tblId][kind].add(`${relId._type}|${relId.id}`)
          }
        }
      }
    });
    return tbl;
  }

  _getNextReady(tbl) {
    let next
    for (const id of Object.keys(tbl)) {
      if (tbl[id].required.size == 0) {
        if (next !== undefined) {
          if (tbl[id].optional.size < tbl[next].optional.size)
            next = id
        }
        else
          next = id
      }
      if (next !== undefined && tbl[next].optional.size == 0)
        break
    }
    if (next) {
      const nextId = `${tbl[next].id._type}|${tbl[next].id.id}`
      for (const id of Object.keys(tbl)) {
        tbl[id].required = tbl[id].required.remove(nextId)
        tbl[id].optional = tbl[id].optional.remove(nextId)
      }
    }
    return next
  }

  /**
   * Commit the current head.
   *
   * Once a head state is ready to be considered permanent, it should be
   * committed. This compacts the existing diffs and sets the tail
   * of the DB to be the head.
   */
  commit() {
    let diffs = this.getDiffs()

    // Check the diffs for many-to-many updates and split those off into separate
    // diffs; they need separate API calls to set.
    let newDiffs = []
    for( let diff of diffs ) {
      let extraDiffs = []
      const id = getDiffId(diff)
      const model = this.getModel(diff._type[0] || diff._type[1])
      for (const fieldName of model.iterManyToMany()) {
        if (!diff[fieldName])
          continue
        if (diff[fieldName][0] && diff[fieldName][0].size) {
          extraDiffs.push({
            _type: [id._type, id._type],
            id: [id.id, id.id],
            [fieldName]: [diff[fieldName][0], new OrderedSet()]
          })
        }
        if (diff[fieldName][1] && diff[fieldName][1].size) {
          extraDiffs.push({
            _type: [id._type, id._type],
            id: [id.id, id.id],
            [fieldName]: [new OrderedSet(), diff[fieldName][1]]
          })
        }
        delete diff[fieldName]
      }

      // Only add the original diff if it either does not exist in the
      // tail, or has attributes to be set.
      if (!this.exists(getDiffId(diff), 'tail') || Object.keys(diff).length > 2)
        newDiffs.push(diff)

      for(const d of extraDiffs)
        newDiffs.push(d)
    }

    // The new diffs need to be inserted after the diffs corresponding
    // to the current tail pointer. The diffs after the tail pointer
    // should be discarded, as the new diffs represent the compacted
    // version of those. The tail pointer should also be updated to
    // the new location.
    console.debug(`Committing ${newDiffs.length} new diff(s)`)
    const tp = this.data.get('tailptr')
    this.data = this.data.update('diffs', x => x.slice(0, tp).concat(newDiffs))
    this.data = this.data.update('tailptr', x => x + newDiffs.length)

    // Reset tail to head.
    this.data = this.data.set('tail', this.data.get('head'))
  }

  createInstance(type, data) {
    return this.getInstance(this.create({ _type: type, ...data }))
  }

  create2(type, data) {
    return this.create({_type: type, ...data})
  }

  create(data) {
    const model = this.getModel(data._type)
    const id = data.id || uuid.v4()
    let object = this.toObject({
      ...data,
      id
    })
    if (object.id === undefined)
      object = object.set('id', uuid.v4())
    const diff = model.diff(undefined, object)
    this.applyDiff(diff)
    this.data = this.data.update('diffs', x => x.push(diff))
    return object
  }

  update(full, partial) {
    let existing = this.get(full._type, full.id)
    if (existing === undefined)
      throw new ModelError('Cannot update non-existant object.')
    const model = this.getModel(existing._type)

    let updated
    if (partial !== undefined) {
      updated = existing
      for (const field of model.iterFields()) {
        if (field in partial)
          updated = updated.set(field, model.toInternal(field, partial[field], this))
      }
    }
    else
      updated = this.toObject(full)

    // Create a diff and add to the chain.
    const diff = model.diff( existing, updated );
    if (diff) {
      this.data = this.data.update('diffs', x => x.push(diff))

      // If we wanted to keep the full diff-chain we'd add it here, but
      // for now let's just update the head.
      this.applyDiff( diff );
    }

    return updated
  }

  createOrUpdate( obj ) {
    if (this.get({_type: obj._type, id: obj.id}) === undefined)
      return this.create(obj)
    else
      return this.update(obj)
  }

  /* getOrCreate( type, query ) {
     const obj = this.get( type, query );
     if( obj === undefined )
     return {_type: type, id: uuid.v4(), ...query};
     return obj;
     } */

  remove(typeOrObject, id) {
    let type
    if (id === undefined) {
      type = typeOrObject._type
      id = typeOrObject.id
    }
    else
      type = typeOrObject
    const model = this.getModel(type)
    let object = this.get(type, id)
    id = makeId(object)
    const diff = model.diff(object, undefined)
    this.applyDiff(diff)
    this.data = this.data.update('diffs', x => x.push(diff))
  }

  applyDiff(diff, reverse = false, branch = 'head') {
    const id = getDiffId(diff)
    let tbl = this.getTable(id._type, branch)
    tbl.applyDiff(diff, reverse)
    this.saveTable(tbl, branch)
    this._applyDiffRelationships(diff, reverse, branch)
  }

  _applyDiffRelationships(diff, reverse = false, branch = 'head') {
    const ii = reverse ? 1 : 0;
    const jj = reverse ? 0 : 1;
    const id = makeId( getDiffId( diff ) )
    const model = this.getModel( id._type );
    for( const field of model.iterFields() ) {
      if( diff[field] === undefined )
        continue;
      const relInfo = model.relationships.get( field );
      if( !relInfo )
        continue;
      const relName = relInfo.get( 'relatedName' );
      const relType = relInfo.get( 'type' );
      if( relInfo.get( 'reverse' ) || !relName || !relType )
        continue;
      let tbl = this.getTable( relType, branch );
      if( relInfo.get( 'many' ) ) {

        // M2Ms store the removals in 0 (ii), and the additions in 1 (jj).
        if (!isNil(diff[field][ii])) {
          diff[field][ii].forEach(relId => {
            tbl.removeRelationship(relId.id, relName, id)
          });
        }
        if (!isNil(diff[field][jj]))
          diff[field][jj].forEach( relId => tbl.addRelationship( relId.id, relName, id ) )
      }
      else {

        // Don't update the reverse relationships if the value
        // hasn't changed.
        if( diff[field][ii] != diff[field][jj] ) {
          let relId = diff[field][ii]
          if( relId )
            tbl.removeRelationship( relId.id, relName, id )
          relId = diff[field][jj]
          if( relId )
            tbl.addRelationship( relId.id, relName, id )
        }
      }
      this.saveTable( tbl, branch )
    }
  }

  /**
   *
   */
  commitDiff(diff) {

    // If no diff was given, use the oldest one available.
    // If no such diff is available then return.
    if (!diff) {
      diff = this.getOutgoingDiffs().get(0)
      if (!diff) {
        return 'done'
      }
    }

    // Find the model, convert data to JSON API, and send using
    // the appropriate operation.
    const type = getDiffId(diff)._type
    const model = this.getModel(type)
    if (model === undefined)
      throw new ModelError(`No model of type "${type}" found during \`commitDiff\`.`)
    const op = getDiffOp(diff)
    const data = model.diffToJsonApi(diff, this)
    console.debug('Pushing diff: ', diff)

    // Different method based on operation.
    let promise
    if (op == 'create') {
      if (!model.ops || model.ops[op] === undefined)
        throw new ModelError(`No such operation, ${op}, defined for model type ${type}`)
      try {
        promise = model.ops.create(data)
      }
      catch (err) {
        throw new ModelError(`Failed to execute create operation for type "${type}".`)
      }
    }
    else if (op == 'update') {

      // Don't try and send an update if the change is purely M2M.
      let doUpdate = true
      for (const f of model.iterManyToMany()) {
        if (!isNil(diff[f])) {
          doUpdate = false
          break
        }
      }

      if (doUpdate) {
        if (!model.ops || model.ops[op] === undefined)
          throw new ModelError(`No such operation, ${op}, defined for model type ${type}`)
        try {
          promise = model.ops.update(data.data.id, data)
        }
        catch (err) {
          throw new ModelError(`Failed to execute update operation for type "${type}".`)
        }
      }
    }
    else if (op == 'remove') {
      if (!model.ops || model.ops[op] === undefined)
        throw new ModelError(`No such operation, ${op}, defined for model type ${type}`)
      try {
        promise = model.ops.remove(data.data.id)
      }
      catch (err) {
        throw new ModelError(`Failed to execute remove operation for type "${type}".`)
      }
    }
    else
      throw new ModelError(`Unknown model operation: ${op}`)

    // Update M2M values. Remember that M2Ms are split out individually
    // from primary diffs, meaning we'll only get one at a time.
    if (isNil(promise)) {
      for (const field of model.iterManyToMany()) {
        if (field in diff) {
          if (diff[field][1] && diff[field][1].size) {
            if(!model.ops[`${field}Add`])
              throw new ModelError(`No many-to-many add declared for field "${field}".`)
            promise = model.ops[`${field}Add`](
              data.data.id,
              {
                data: diff[field][1].toJS().map(
                  x => ({type: x._type, id: this.unmapID(x._type, x.id)})
                )
              }
            )
          }
          else if (diff[field][0] && diff[field][0].size) {
            if (!model.ops[`${field}Remove`])
              throw new ModelError(`No many-to-many remove declared for field "${field}".`)
            promise = model.ops[`${field}Remove`](
              data.data.id,
              {
                data: diff[field][0].toJS().map(
                  x => ({type: x._type, id: this.unmapID(x._type, x.id)})
                )
              }
            )
          }
        }
      }
    }

    // Note that popping the diff from the set is done in `postCommitDiff`.

    return promise
  }

  postCommitDiff(response, diff) {

    // If no diff was supplied, operate on the first in the queue,
    // including unshifting it and updating the tail pointer.
    if (!diff) {
      diff = this.data.getIn(['diffs', 0])
      this.data = this.data.update('diffs', x => x.shift())
      this.data = this.data.update('tailptr', x => x -= 1)
    }

    // If we've created a new resource, keep track of the official
    // identifier in the temporary mapping table.
    if (getDiffOp(diff) == 'create') {
      const {data} = response
      const type = getDiffType(diff)
      const fromID = toID(toArray(data)[0].id)
      if (isEmpty(fromID)) {
        console.warn('Invalid response to create: no ID returned.')
        return false
      }
      const _toID = diff.id[1]
      this.data = this.data.updateIn(
        ['ids', type],
        x => {
          if (!x) x = new Map()
          return x.set(fromID, _toID)
        }
      )
      return true
    }

    return false
  }

  startTransaction( name ) {
    if( this.data.hasIn( ['transactions', name] ) ) {
      throw new ModelError( `Duplicate transaction: ${name}` );
    }
    const data = this.data.merge({

      // Replace the transaction tail with our current head. This
      // way when we calculate diffs we'll get only the difference
      // between the main head and our transaction head.
      tail: this.data.get( 'head' ),
    });
    this.data = this.data.setIn( ['transactions', name], data );
    return this.getTransaction( name );
  }

  getTransaction( name ) {
    if( !this.data.hasIn( ['transactions', name] ) )
      return;
    return new Transaction( this, name );
  }

  saveTransaction( trans ) {
    this.data = this.data.setIn( ['transactions', trans.name], trans.data );
  }

  commitTransaction( trans ) {
    if( typeof trans == 'string' ) {
      trans = this.getTransaction( trans )
    }
    this.loadJsonApi( trans.data.get( 'loads', [] ) )
    for( const objs of trans.data.get( 'objectLoads', [] ) ) {
      this.loadObjects( objs )
    }
    const diffs = trans.getDiffs()
    for( const diff of diffs ) {
      this.applyDiff( diff )
    }

    // TODO: Don't abort the transaction as it causes transaction-components
    // to create a new transaction. Instead, keep it around. The TODO is because
    // we may need to undo this later.
    /* this.abortTransaction( trans.name );*/
  }

  abortTransaction( trans ) {
    if( typeof trans != 'string' )
      trans = trans.name;
    this.data = this.data.deleteIn( ['transactions', trans] );
  }

  saveJson(filename) {
    saveJson(this.data.toJS(), filename)
  }

  loadJson(file) {
    return loadJson(file).then(r => {
      this.reset(r)
      this._updateReverseRelationships('head')
      this._updateReverseRelationships('tail')
    })
  }

  /**
   *
   */
  /* *calcOrderedDiffs() {
     const { local } = this.data;
     let done = {};
     for( const type of Object.keys( local ) ) {
     for( const obj of local[type].objects ) {
     for( const diff of this._calcOrderedDiffs( type, obj.id, done ) )
     yield diff;
     }
     }
     } */

  /* *_calcOrderedDiffs( type, id, done={} ) {
     if( type in done && id in done[type] )
     return;
     if( !(type in done) )
     done[type] = {};
     done[type][id] = true;
     const obj = this.get( type, id );
     const { relationships = {} } = obj;
     const model = schema.getModel( type );
     for( const relType of Object.keys( relationships ) ) {
     let relData = relationships[relType].data || [];
     if( !(relData instanceof Array) )
     relData = [ relData ];
     for( const rel of relData ) {
     for( const relDiff of this._calcOrderedDiffs( relType, rel.id, done ) )
     yield relDiff;
     }
     }
     const diff = model.diff( obj, this.getServer( type, id ) );
     if( diff )
     yield diff;
     } */
}

class Transaction extends DB {

  constructor( db, name ) {
    super( db.data.getIn( ['transactions', name] ), {schema: db.schema} );
    this.name = name;
  }

  loadJsonApi( response ) {
    super.loadJsonApi( response );
    this.data = this.data.update( 'loads', x => x.push( response ) );
  }

  loadObjects( objects ) {
    super.loadObjects( objects );
    this.data = this.data.update( 'objectLoads', x => x.push( objects ) );
  }
}
