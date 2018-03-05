import { Map } from 'immutable'
import uuid from 'uuid'

import {
  isEmpty,
  toArray,
  cmpIds,
  toList,
  ModelError
} from './utils'

/**
 * Base class for instances.
 *
 * Holds the common information between on-the-fly instances, created
 * with the below Instance class, and anonymous model instances.
 */
export class BaseInstance {

  constructor( data, model, db ) {
    if( isEmpty( model ) ) {
      throw new ModelError( 'Instance: No model given.' )
    }
    if( isEmpty( db ) ) {
      throw new ModelError( 'Instance: No DB given.' )
    }
    this.id = data.get( 'id' ) || uuid.v4()
    this._db = db
    this._model = model
    this._type = model.type
    this._initial = new Map()
    this._values = data
  }

  save() {
    this._db.createOrUpdate( this._values )
  }

  delete() {
    this._db.remove( this._values )
  }

  reset() {
    this._values = this._initial
  }

  getDB() {
    return this._db
  }

  getModel() {
    return this._model
  }

}

/**
 * A convenience class to represent model data.
 *
 * Provides getters/setters to assist in modifying model data locally,
 * then saving to the DB later. Also wraps relationships to make
 * finding local DB instances easier.
 */
export default class Instance extends BaseInstance {
  constructor( ...args ) {
    super( ...args )
    this._model.addAttributesToObject( this )
    this._model.addRelationshipsToObject( this )
  }
}
