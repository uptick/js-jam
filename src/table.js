import { List, Map, Set, fromJS, Record } from 'immutable'

import { Filter, DBVisitor } from './filter'
import { ModelError, getDiffId, ID, isEmpty, isObject, isRecord, negate } from './utils'

/**
 * Represents data of a particular type.
 */
export default class Table {

  static filterRegex = /^([a-zA-Z](?:_?[a-zA-Z0-9])+)__([a-zA-Z](?:_?[a-zA-Z0-9])+)$/

  /**
   * `data` can be one of: a list of objects, a pre-constructed immutable
   * map containing table data, or undefined.
   *
   * TODO: This is a bit inefficient given how often it will be called.
   */
  constructor(type, options = {}) {
    let {data, db, idField = 'id', indices} = options
    this.type = type
    this.db = db
    this.model = db.getModel(type, true)
    this.idField = idField

    // Figure out what my indices are.
    this.indices = new Set(indices || this.model.indices || ['id'])
    if (!this.indices.has(idField))
      throw new ModelError(`idField: ${idField} not found in indices: ${indices}`)

    if (data) {
      if (Array.isArray(data)) {
        this.data = new Map({
          objects: db.toObjects(new List(data)),
          indices: new Map(this.indices.toJS().map(x =>
            [x, new Map(this._toIndexMap(data, x))])
          )
        })
      }
      else if (Map.isMap(data))
        this.data = data
      else {
        this.data = new Map({
          objects: db.toObjects(new List(data.objects)),
          indices: fromJS(data.indices)
        })
      }
    }
    else
      this.reset()
  }

  reset() {
    this.data = new Map({
      objects: new List(),
      indices: new Map(this.indices.toJS().map(x => [x, new Map()]))
    })
  }

  resetIndices() {
    this.data = this.data.set('indices', new Map(this.indices.toJS().map(x =>
      [x, new Map(this._toIndexMap(this.data.get('objects'), x))]
    )))
  }

  _toIndexMap(objects, key = 'id') {
    let index = new Map()
    if (!isEmpty(objects)) {
      objects.forEach((item, ii) => {
        const val = this.toIndexable(key, item[key])
        if (!index.has(val))
          index = index.set(val, new Set([ii]))
        else
          index = index.updateIn([val], x => x.add(ii))
      })
    }
    return index
  }

  size() {
    return this.data.getIn(['indices', this.idField]).size
  }

  at(index) {
    return this.data.get('objects').get(index)
  }

  /**
   * Get a single object matching the query.
   */
  get(id, required) {
    const idx = this.data.getIn(['indices', 'id', this.toIndexable('id', this.db.mapID(this.type, id))])
    if (idx === undefined) {
      if (required)
        throw new ModelError('No such object.')
      return
    }
    return this.data.getIn(['objects', idx.first()])
  }

  /**
   * Filter objects based on a query.
   */
  filter(idOrQuery) {
    let results
    if (!idOrQuery)
      results = this.data.get('objects').valueSeq().toArray()
    else {
      if (!Filter.isFilter(idOrQuery))
        idOrQuery = Filter.toFilter(idOrQuery) // TODO: Deprecate one day?
      const visitor = new DBVisitor(this.db, this.type)
      results = visitor.execute(idOrQuery)
    }
    return results
  }

  /**
   * Convert a set of indices to records.
   */
  _mapIndices(indices) {
    return indices.map(ii => this.data.getIn(['objects', ii]))
  }

  set(object) {
    // TODO: Is this a performance issue?
    object = this.db.toObject(object)

    // If the object doesn't exist, just add it on to the end. Don't
    // worry about adding all the indices, we'll put them in at the
    // end.
    const id = object[this.idField]
    if(isEmpty(id))
      throw new ModelError('No ID given for "table.set".')
    const existing = this.get(id)
    if (!existing) {
      const size = this.data.get('objects').size
      this.data = this.data
                      .update('objects', x => x.push(object))
                      .setIn(['indices', this.idField, this.toIndexable(this.idField, id)], new Set([size]))
    }
    else {

      // Don't stomp on the existing object's ID. After a reID has been run
      // we keep around the old ID reference. Occasionally, an object may be
      // updated using the old ID, so we need to ensure we don't stomp it.
      object = object.set('id', existing.id)

      // Eliminate the object's index from current indices and set the
      // new object.
      const index = this._getIndex(id)
      this._removeFromIndices(existing)
      this.data = this.data.setIn(['objects', index], object)
    }

    // Add indices.
    const index = this._getIndex(id)
    this.data.get('indices').forEach((ii, field) => {
      if(field == this.idField)
        return
      const value = this.toIndexable(field, object.get(field))
      this.data = this.data.updateIn(['indices', field, value], x => {
        return (x === undefined) ? new Set([index]) : x.add(index)
      })
    })
  }

  toIndexable(field, value) {
    return this.model.toIndexable(field, value)
  }

  _getIndex(id) {
    let index = this.data.getIn(['indices', this.idField, this.toIndexable(this.idField, id)])
    if(index === undefined) {
      console.trace()
      throw new ModelError(`Unknown ID in index lookup for type "${this.model.type}" and ID "${id}"`)
    }
    return index.first()
  }

  /**
   * Eliminate the object's index from current indices.
   */
  _removeFromIndices(object) {
    const id = object.get(this.idField)
    const index = this._getIndex(id)
    this.data.get('indices').forEach((ii, field) => {
      if (field == this.idField)
        return
      const value = this.toIndexable(field, object.get(field))

      // Remove the object's ID from the index.
      this.data = this.data.updateIn( ['indices', field, value], x => x.delete( index ) );

      // Remove the index if it's now empty.
      if( this.data.getIn( ['indices', field, value] ).size == 0 )
        this.data = this.data.deleteIn( ['indices', field, value] );
    });
  }

  remove(idOrQuery) {
    const obj = this.get(idOrQuery)
    if (!obj)
      return
    const id = obj.get('id')
    const index = this._getIndex(id)

    // Remove from extra indices and also the ID index.
    this._removeFromIndices(obj)
    this.data = this.data.deleteIn(['indices', this.idField, id])

    // Can't remove the object or I ruin the indices, unless it's right
    // at the end.
    if (index == this.data.get('objects').size - 1)
      this.data = this.data.update('objects', x => x.slice(0, -1))
    else
      this.data = this.data.setIn(['objects', index], null)
  }

  /**
   * Call a function for each related object.
   * TODO: Should use "iterRelated"?
   */
  forEachRelatedObject(id, callback) {
    const obj = this.get(id, true)
    const model = this.model
    for (const fldName of model.iterForeignKeys({includeReverse: true})) {
      const fld = model.getField(fldName)
      const relName = model.relationships.getIn([fldName, 'relatedName'])
      if (obj[fldName])
        callback(obj[fldName], relName)
    }
    for (const fldName of model.iterManyToMany({includeReverse: true})) {
      const fld = model.getField(fldName)
      const relName = model.relationships.getIn([fldName, 'relatedName'])
      for (const rel of obj[fldName])
        callback(rel, relName)
    }
  }

  addRelationship(id, fldName, relatedId) {
    const fld = this.model.getField(fldName)
    if (relatedId._type != fld.get('type')) {
      //      throw new ModelError('Cannot add incompatible type: ', relatedId._type, ' to relationship with type: ', fld.get('type'))
      return
    }
    const index = this._getIndex(id)
    this.data = this.data.updateIn(['objects', index, fldName], x => x.add(relatedId))
  }

  removeRelationship(id, field, relatedId) {
    const index = this._getIndex(id)
    this.data = this.data.updateIn(['objects', index, field], x => x.delete(relatedId))
  }

  /**
   * Iterate over all objects in table.
   */
  * iterObjects() {
    for( const obj of this.data.get( 'objects' ) ) {

      // Need to check if empty due to the way deletes work (they
      // temporarily store an empty entry in the table).
      if( !isEmpty( obj ) ) {
        yield obj
      }
    }
  }

  /**
   * Iterate over related object(s) for object's field.
   */
  * iterRelated(id, field) {
    const obj = this.get( id )
    if( obj ) {
      const many = this.model.relationships.getIn( [field, 'many'] )
      if( many ) {
        for( const rel of obj[field] ) {
          yield rel
        }
      }
      else if( obj[field] ) {
        yield obj[field]
      }
    }
  }

  applyDiff(diff, reverse = false) {
    const id = getDiffId(diff)
    let rec = this.get(id.id)
    rec = this.model.applyDiff(rec, diff, reverse, this.db)
    if (rec === null) {
      const ii = reverse ? 1 : 0
      this.remove(diff.id[ii])
    }
    else
      this.set(rec)
  }
}
