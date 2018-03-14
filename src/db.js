import { bindActionCreators } from 'redux'
import uuid from 'uuid'
import { List, Map, OrderedMap, Set, OrderedSet } from 'immutable'

import Table from './table'
import { toArray, makeId, getDiffOp, getDiffId, isObject, isIterable,
         toList, Rollback, ModelError, splitJsonApiResponse, saveJson, loadJson } from './utils'
import * as modelActions from './actions'

export default class DB {

  static Rollback = Rollback

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor( data, options = {} ) {
    this.schema = options.schema
    if( Map.isMap( data ) )
      this.data = data
    else
      this.reset( data )
  }

  reset( data ) {
    this.data = new Map({
      head: new Map(),
      tail: new Map(),
      ids: new Map(),
      diffs: new List(),

      // TODO: Deprecated?
      chain: new Map({
        diffs: new List(),
        blocks: new List(),
        current: 0,
        server: 0
      }),

      transactions: new Map(),
      loads: new List(),
      objectLoads: new List()
    })
    if( data ) {
      const { head = {}, tail = {} } = data
      Object.keys( head ).forEach( type => {
        let tbl = new Table( type, {data: head[type], db: this} )
        this.data = this.data.setIn( ['head', type], tbl.data )
      })
      Object.keys( tail ).forEach( type => {
        let tbl = new Table( type, {data: tail[type], db: this} )
        this.data = this.data.setIn( ['tail', type], tbl.data )
      })
      // TODO: ids
      // TODO: diffs
    }
  }

  resetHead() {
    this.data = this.data.set( 'head', this.data.get( 'tail' ) )
  }

  bindDispatch( dispatch ) {
    this.dispatch = dispatch
    this.actions = bindActionCreators( modelActions, dispatch )
  }

  /**
   * Clear the database in preparation for new data.
   */
  clear() {

    // Build a set of all outgoing IDs. We don't want to remove any
    // objects that still have outgoing diffs.
    let outgoing = this.data.get( 'diffs' )
                       .filter(
                         diff =>
                           getDiffOp( diff ) != 'remove'
                       )
                       .map(
                         diff =>
                           this.get( getDiffId( diff ) )
                       )

    // Clear head and tail.
    this.data = this.data
                    .set( 'head', new Map() )
                    .set( 'tail', new Map() )

    // Re-insert the outgoing objects.
    outgoing.forEach(
      obj => {
        let tbl = this.getTable( obj._type, 'tail' )
        tbl.set( obj )
        this.saveTable( tbl, 'tail' )
      }
    )
    this.data = this.data.set( 'head', this.data.get( 'tail' ) )
  }

  /**
   * Load models from JSON API format.
   */
  loadJsonApi( response ) {
    if( !isIterable( response ) ) {
      response = [response]
    }

    // Assemble the responses into sets of split objects.
    let splitObjectsSet = response.map(
      resp =>
        splitJsonApiResponse( resp )
    )

    this.loadSplitObjectsSet( splitObjectsSet )
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

  loadSplitObjectsSet( splitObjectsSet ) {
    splitObjectsSet = toList( splitObjectsSet )

    // Construct our current diffs for later replay. These are changes
    // yet to be committed.
    let localDiffs = this.getDiffs()

    // Unapply my outgoing diffs to makre sure we don't duplicate
    // the diffs.
    for( const diff of this.data.get( 'diffs' ) ) {
      this.applyDiff( diff, true, 'tail' )
    }

    // Load all reponse objects.
    for( const splitObjects of splitObjectsSet ) {

      // Now update the head data state to reflect the new server
      // information.
      Object.keys( splitObjects ).forEach( type => {

        // Skip any tables we don't have a model type for.
        let tbl
        try {
          tbl = this.getTable( type, 'tail' )
        }
        catch( e ) {
          // TODO: Catch specific type for missing model.
          console.warn( e )
          return;
        }

        splitObjects[type].map( obj => {
          tbl.set( obj )
        })
        this.saveTable( tbl, 'tail' )
      })
    }

    // Recalculate reverse-related fields.
    this._updateReverseRelationships( 'tail' )

    // Replay outgoing diffs onto tail. This is to match the expectation
    // that outgoing diffs will be applied to the server.
    for( const diff of this.data.get( 'diffs' ) )
      this.applyDiff( diff, false, 'tail' )

    // Replace head with tail.
    this.data = this.data.set( 'head', this.data.get( 'tail' ) )

    // Replay local diffs onto head.
    for( const diff of localDiffs )
      this.applyDiff( diff )
  }

  _updateReverseRelationships( branch = 'head' ) {
    this.data.get( branch ).forEach( (tblData, type) => {
      let tbl = this.getTable( type, branch )
      tbl.model.relationships.forEach( (relInfo, field) => {
        if( relInfo.get( 'reverse' ) )
          return;
        tbl.data.get( 'objects' ).forEach( obj => {

          // `obj` can be null if we've removed some objects.
          if( obj === null )
            return;

          for( const rel of tbl.iterRelated( obj.id, field ) ) {
            let relTbl
            try {
              relTbl = this.getTable( rel._type, branch );
            }
            catch( e ) {
              console.warn( `Unable to find related type "${rel._type}", from "${tbl.type}.${field}"` )
              continue
            }

            const relName = relInfo.get( 'relatedName' );
            if( relName ) {
              const relObj = relTbl.get( rel.id );
              if( relObj !== undefined ) {
                if( !tbl.model.fieldIsForeignKey( relName ) )
                  relTbl.addRelationship( rel.id, relName, obj )
                else
                  relTbl.set( relTbl.get( rel.id ).set( relName, obj ) )
              }
              this.saveTable( relTbl, branch )
            }
          }
        })
      })
    })
  }

  getId( typeOrObject, id ) {
    id = makeId( typeOrObject, id )
    return this.data.getIn( ['ids', id._type, id.id], id )
  }

  makeId( typeOrObject, id ) {
    id = makeId( typeOrObject, id )
    if( id._type === undefined || id.id === undefined )
      return id
    let res = this.data.getIn( ['ids', id._type, id.id] )
    if( res === undefined ) {
      this.data = this.data.setIn( ['ids', id._type, id.id], id )
      res = id
    }
    return res
  }

  getModel( type, fail = false ) {
    return this.schema.getModel( type, fail )
  }

  getTable( type, branch = 'head' ) {
    const data = this.data.getIn( [branch, type] )
    return new Table( type, {data, db: this} )
  }

  saveTable( table, branch = 'head' ) {
    this.data = this.data.setIn( [branch, table.type], table.data );
  }

  toObject( data ) {
    return this.schema.toObject( data, this )
  }

  toObjects( data ) {
    return this.schema.toObjects( data, this );
  }

  getInstance( typeOrQuery, idOrQuery ) {

    // Don't flip out if the model doesn't exist.
    let obj
    try {
      obj = this.get( typeOrQuery, idOrQuery );
    }
    catch( e ) {
      // TODO: Catch specific error.
      console.warn( e );
      return undefined
    }

    if( obj === undefined )
      throw new ModelError( `Failed to find object: ${typeOrQuery._type}, ${typeOrQuery.id}` )
    // TODO: Should be using `obj` from above here or what?!
    return this.schema.toInstance(
      this.get( typeOrQuery, idOrQuery ),
      this
    );
  }

  exists( id, branch='head' ) {
    return this.getTable( id._type, branch ).get( id.id ) !== undefined;
  }

  /**
   * Filter data both locally and on the server.
   */
  filter( type, filter, options ) {
    // TODO: Query the server if we have network and have not
    //   been flagged to avoid external requests.
    // if( navigator.onLine ) {
    //  options.filter = filter  // TODO: merge? 
    // }
    return Promise.resolve(
      this.getTable( type ).filter( filter )
    )
  }

  query( options ) {
    const { type, filter, ...other } = options
    return this.filter( type, filter, other )
  }

  /**
   * get( object )
   * get( {_type:, id:}
   * get( '', 3 )
   * get( '', {key: } )
   */
  get( typeOrQuery, idOrQuery ) {
    let query, type;
    if( idOrQuery === undefined ) {
      if( typeOrQuery === undefined )
        return;
      type = typeOrQuery._type;
      if( typeOrQuery._map !== undefined ) {
        query = {id: typeOrQuery.id};
      }
      else {
        const {_type: x, ...y} = typeOrQuery;
        query = y;
      }
    }
    else if( isObject( idOrQuery ) ) {
      type = typeOrQuery;
      query = idOrQuery;
    }
    else {
      type = typeOrQuery;
      query = {id: idOrQuery};
    }
    return this.getTable( type ).get( query );
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

  /**
   * Begin an atomic transaction.
   */
  withBlock( operation ) {
    if( this._inBlock )
      throw ModelError( 'Already in DB block.' );
    const chain = this.data.get( 'chain' );
    const current = chain.get( 'current' );
    try {
      operation();
      if( this.data.getIn( ['chain', 'current'] ) != current )
        this.data = this.data.updateIn( ['chain', 'blocks'], x => x.push( current ) );
      this._inBlock = false;
    }
    catch( err ) {
      this.goto( current );
      this.data = this.data.set( 'chain', chain );
      this._inBlock = false;
      if( !(err instanceof Rollback) )
        throw err;
    }
  }

  getBlock( index ) {
    const blocks = this.data.getIn( ['chain', 'blocks'] );
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    if( index === undefined )
      index = 0;
    if( !blocks.size || index >= blocks.size )
      return [];
    const start = blocks.get( blocks.size - index - 1 );
    const finish = blocks.get( blocks.size - index );
    return diffs.slice( start, finish );
  }

  getBlocks( nBlocks ) {
    let blocks = [];
    for( let ii = 0; ii < nBlocks; ++ii )
      blocks.push( this.getBlock( nBlocks - ii - 1 ) );
    return blocks;
  }

  getDiffs() {
    let diffs = [];
    let tbl = this._makeDependencyTable();
    let id = this._getNextReady( tbl );
    while( id ) {
      if( tbl[id].optional.size > 0 ) {
        const [mainDiff, auxDiff] = this._splitDiff( tbl[id] );
        diffs.push( mainDiff );
        tbl[id].diff = auxDiff;
        tbl[id].required = tbl[id].optional;
        tbl[id].optional = new Set();
      }
      else {
        diffs.push( tbl[id].diff );
        delete tbl[id];
      }
      id = this._getNextReady( tbl );
    }

    // Add removals.
    this.schema.models.map( (model, type) => {
      const headTbl = this.getTable( model.type, 'head' )
      const tailTbl = this.getTable( model.type, 'tail' )
      for( const tailObj of tailTbl.iterObjects() ) {
        const headObj = headTbl.get( tailObj.id )
        if( headObj )  // ony want removals
          continue
        const diff = model.diff( tailObj, headObj )
        if( !diff ) {  // can this even happen?
          continue
        }
        diffs.push( diff )
      }
    })
    /* for( const rem of this.data.get( 'removals' ) ) {
     *   diffs.push({
     *     _type: [rem._type, undefined],
     *     id: [rem.id, undefined]
     *   });
     * }*/

    return diffs;
  }

  _splitDiff( info ) {
    const {diff, optional} = info;
    let auxDiff = {};
    const model = this.getModel( diff._type[1] );
    for( const fieldName of model.iterRelationships() ) {
      if( !(fieldName in diff) )
        continue;
      const field = model.getField( fieldName );
      if( field.get( 'many' ) ) {
        auxDiff[fieldName] = [
          diff[fieldName][0].filter( x => !optional.has( x ) ),
          diff[fieldName][1].filter( x => !optional.has( x ) )
        ];
        diff[fieldName] = [
          diff[fieldName][0].filter( x => optional.has( x ) ),
          diff[fieldName][1].filter( x => optional.has( x ) )
        ];
      }
      else {
        if( diff[fieldName][1] == id ) {
          auxDiff[fieldName] = diff[fieldName];
          delete diff[fieldName];
        }
      }
    }
    return [diff, auxDiff];
  }

  _makeDependencyTable() {
    let tbl = {};
    this.schema.models.map( (model, type) => {
      const headTbl = this.getTable( model.type, 'head' );
      const tailTbl = this.getTable( model.type, 'tail' );
      for( const headObj of headTbl.iterObjects() ) {
        const tailObj = tailTbl.get( headObj.id );
        const diff = model.diff( tailObj, headObj );
        if( !diff )
          continue
        const id = this.getId( headObj );
        const tblId = `${id._type}-${id.id}`;
        tbl[tblId] = {
          id: id,
          diff,
          required: new Set(),
          optional: new Set()
        };
        for( const fieldName of model.iterRelationships() ) {
          const field = model.getField( fieldName );
          if( diff[fieldName] === undefined )
            continue;
          let related = diff[fieldName][1];
          if( !field.get( 'many' ) )
            related = [related];
          for( const relId of related ) {
            if( relId === undefined || this.exists( relId, 'tail' ) )
              continue;
            let kind = field.get( 'required' ) ? 'required' : 'optional';
            tbl[tblId][kind] = tbl[tblId][kind].add( relId );
          }
        }
      }
    });
    return tbl;
  }

  _getNextReady( tbl ) {
    let next;
    for( const id of Object.keys( tbl ) ) {
      if( tbl[id].required.size == 0 ) {
        if( next !== undefined ) {
          if( tbl[id].optional.size < tbl[next].optional.size )
            next = id;
        }
        else
          next = id;
      }
      if( next !== undefined && tbl[next].optional.size == 0 )
        break;
    }
    for( const id of Object.keys( tbl ) ) {
      tbl[id].required = tbl[id].required.remove( tbl[next].id );
      tbl[id].optional = tbl[id].optional.remove( tbl[next].id );
    }
    return next;
  }

  commit() {
    let diffs = this.getDiffs()

    // Check the diffs for many-to-many updates and split those off into separate
    // diffs; they need separate API calls to set.
    let newDiffs = []
    for( let diff of diffs ) {
      let extraDiffs = []
      const id = getDiffId( diff )
      const model = this.getModel( diff._type[0] || diff._type[1] )
      for( const fieldName of model.iterManyToMany() ) {
        if( !diff[fieldName] )
          continue
        if( diff[fieldName][0] && diff[fieldName][0].size ) {
          extraDiffs.push({
            _type: [id._type, id._type],
            id: [id.id, id.id],
            [fieldName]: [diff[fieldName][0], new OrderedSet()]
          })
        }
        if( diff[fieldName][1] && diff[fieldName][1].size ) {
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
      if( !this.exists( getDiffId( diff ), 'tail' ) || Object.keys( diff ).length > 2 )
        newDiffs.push( diff )

      for( const d of extraDiffs )
        newDiffs.push( d )
    }

    // Store the resulting diffs on top of existing ones.
    console.debug( `DB: Committing ${newDiffs.length} new diff(s)` )
    this.data = this.data.update( 'diffs', x => x.concat( newDiffs ) )

    // Reset tail to head.
    this.data = this.data.set( 'tail', this.data.get( 'head' ) )
  }

  createInstance( type, data ) {
    return this.schema.createInstance( type, data, this )
  }

  create( data ) {
    const model = this.getModel( data._type )
    let object = this.toObject( data )
    if( object.id === undefined )
      object = object.set( 'id', uuid.v4() )
    
    const diff = model.diff( undefined, object )
    /* this.addDiff( diff );*/
    this.applyDiff( diff )
    return this.makeId( getDiffId( diff ) )
  }

  update( full, partial ) {
    let existing = this.get( full._type, full.id )
    if( existing === undefined )
      throw new ModelError( 'Cannot update non-existant object.' )
    const model = this.getModel( existing._type )

    let updated
    if( partial !== undefined ) {
      updated = existing;
      for( const field of model.iterFields() ) {
        if( field in partial )
          updated = updated.set( field, partial[field] );
      }
    }
    else
      updated = this.toObject( full )

    // Create a diff and add to the chain.
    const diff = model.diff( existing, updated );
    if( diff ) {

      // If we wanted to keep the full diff-chain we'd add it here, but
      // for now let's just update the head.
      this.applyDiff( diff );
      // this.addDiff( diff );
    }
  }

  createOrUpdate( obj ) {
    if( this.get({ _type: obj._type, id: obj.id }) === undefined )
      return this.create( obj )
    else
      return this.update( obj )
  }

  /* getOrCreate( type, query ) {
     const obj = this.get( type, query );
     if( obj === undefined )
     return {_type: type, id: uuid.v4(), ...query};
     return obj;
     } */

  remove( typeOrObject, id ) {
    let type;
    if( id === undefined ) {
      type = typeOrObject._type;
      id = typeOrObject.id;
    }
    else
      type = typeOrObject;
    const model = this.getModel( type );
    let object = this.get( type, id );
    id = this.getId( object );
    const diff = model.diff( object, undefined );
    this.applyDiff( diff );
  }

  undoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    while( current ) {
      this.undo();
      current -= 1;
    }
  }

  undo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( !current )
      return;
    let diff = diffs.get( current - 1 );
    this.applyDiff( diff, true );
    this.data = this.data.setIn( ['chain', 'current'], current - 1 );
  }

  redoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    while( current < diffs.size ) {
      this.redo();
      current += 1;
    }
  }

  redo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( current == diffs.size )
      return;
    let diff = diffs.get( current );
    this.applyDiff( diff );
    this.data = this.data.setIn( ['chain', 'current'], current + 1 );
  }

  addBlock( block ) {
    const offset = this.data.getIn( ['chain', 'diffs'] ).size;
    for( const diff of block )
      this.addDiff( diff );
    this.data = this.data.updateIn( ['chain', 'blocks'], x => x.push( offset ) );
  }

  addDiff( diff ) {
    this.data = this.data
                    .updateIn( ['chain', 'diffs'], x => x.push( diff ) )
                    .updateIn( ['chain', 'current'], x => x + 1 );
    this.applyDiff( diff );
  }

  applyDiff( diff, reverse = false, branch = 'head' ) {
    const id = getDiffId( diff )
    let tbl = this.getTable( id._type, branch )
    tbl.applyDiff( diff, reverse )
    this.saveTable( tbl, branch )
    this._applyDiffRelationships( diff, reverse, branch )
  }

  _applyDiffRelationships( diff, reverse=false, branch='head' ) {
    const ii = reverse ? 1 : 0;
    const jj = reverse ? 0 : 1;
    const id = this.getId( getDiffId( diff ) )
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
        if( diff[field][ii] !== undefined ) {
          diff[field][ii].forEach( relId => {
            tbl.removeRelationship( relId.id, relName, id )
          });
        }
        if( diff[field][jj] !== undefined ) {
          diff[field][jj].forEach( relId => {
            tbl.addRelationship( relId.id, relName, id )
          });
        }
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
   * Move current diff location to `index`.
   */
  goto( index ) {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( index > diffs.size )
      throw ValueError( 'Cannot goto index greater than number of diffs.' );
    if( index < 0 )
      throw ValueError( 'Cannot goto negative index.' );
    while( index < current ) {
      this.undo();
      index += 1;
    }
    while( index > current ) {
      this.redo();
      index -= 1;
    }
  }

  /**
   *
   */
  commitDiff( diff ) {

    // If no diff was given, use the oldest one available.
    // If no such diff is available then return.
    if( !diff ) {
      diff = this.data.getIn( ['diffs', 0] );
      if( !diff )
        return;
    }

    // Find the model, convert data to JSON API, and send using
    // the appropriate operation.
    const type = getDiffId( diff )._type;
    const model = this.getModel( type );
    if( model === undefined )
      throw new ModelError( `No model of type "${type}" found during \`commitDiff\`.` );
    const op = getDiffOp( diff );
    const data = model.diffToJsonApi( diff );

    // Check for valid operation.
    if( !model.ops || model.ops[op] === undefined )
      throw new ModelError( `No such operation, ${op}, defined for model type ${type}` );

    // Different method based on operation.
    let promise;
    if( op == 'create' ) {
      try {
        promise = model.ops.create( data );
        /* .then( response => {
         *   const {data} = response;
         *   const id = toArray( data )[0].id;
         *   this.reId( diff._type[1], diff.id[1], id );
         *   return response;
         * });*/
      }
      catch( err ) {
        throw new ModelError( `Failed to execute create operation for type "${type}".` );
      }
    }
    else if( op == 'update' ) {
      try {
        promise = model.ops.update( data.data.id, data );
      }
      catch( err ) {
        throw new ModelError( `Failed to execute update operation for type "${type}".` );
      }
    }
    else if( op == 'remove' ) {
      try {
        promise = model.ops.remove( data.data.id );
      }
      catch( err ) {
        throw new ModelError( `Failed to execute remove operation for type "${type}".` );
      }
    }
    else
      throw new ModelError( `Unknown model operation: ${op}` );

    // Add on any many-to-many values.
    // TODO: This will currently spawn an unecessary POST above if there is only
    // many-to-many updates. Add a bit to the above that checks if the update is
    // empty and just creates a dummy promise.
    for( const field of model.iterManyToMany() ) {
      if( field in diff ) {
        promise = promise.then( response => {
          if( diff[field][1] && diff[field][1].size ) {
            if( !model.ops[`${field}Add`] )
              throw new ModelError( `No many-to-many add declared for ${field}.` );
            model.ops[`${field}Add`]( data.data.id, {data: diff[field][1].toJS().map( x => ({type: x._type, id: x.id}) )} );
          }
          return response;
        })
        .then( response => {
          if( diff[field][0] && diff[field][0].size ) {
            if( !model.ops[`${field}Remove`] )
              throw new ModelError( `No many-to-many remove declared for ${field}.` );
            model.ops[`${field}Remove`]( data.data.id, {data: diff[field][0].toJS().map( x => ({type: x._type, id: x.id}) )} );
          }
          return response;
        });
      }
    }

    /* // Finally, pop the diff.
    promise = promise.then( response => {
      this.data = this.data.updateIn( ['chain', 'server'], x => x + 1 );
      return response;
    }); */

    return promise;
  }

  postCommitDiff( response, diff ) {
    if( !diff ) {
      diff = this.data.getIn( ['diffs', 0] );

      // Remove the first diff in the chain.
      this.data = this.data.update( 'diffs', x => x.shift() );
    }

    // If we've created an object, perform a reId.
    if( getDiffOp( diff ) == 'create' ) {
      const {data} = response;
      const id = toArray( data )[0].id;
      this.reId( diff._type[1], diff.id[1], id );
    }
  }

  popDiff() {
    this.data = this.data.updateIn( ['chain', 'server'], x => x + 1 );
  }

  /**
   * Change the ID of an object.
   *
   * This is actually a great big jerk. We need to lookup all references
   * to this object across *everything* and change the identifier.
   *
   * NOTE: We can't remove the old ID straight away, as there are cases
   *       where other components still need to reference it.
   */
  reId( type, id, newId, branch ) {
    console.debug( `DB: reId: New ID for ${type}, ${id}: ${newId}` );

    // If no branch was given, do both.
    if( branch === undefined )
      branch = ['head', 'tail'];
    else
      branch = [branch];

    // Perform the reId on both branches.
    for( const br of branch ) {

      // Update the ID of the object itself.
      let tbl = this.getTable( type, br );
      tbl.reId( id, newId );
      this.saveTable( tbl, br );

      // Now update the relationships.
      const model = this.getModel( type );
      const fromId = this.makeId( type, id );
      const toId = this.makeId( type, newId );
      tbl.forEachRelatedObject( newId, (objId, reverseField) => {
        if( !reverseField )
          return;
        const obj = this.get( objId );
        const relTbl = this.getTable( obj._type, br );
        const relModel = relTbl.model;
        if( !relModel.fieldIsForeignKey( reverseField ) ) {
          relTbl.removeRelationship( obj.id, reverseField, fromId );
          relTbl.addRelationship( obj.id, reverseField, toId );
        }
        else
          relTbl.set( obj.set( reverseField, toId ) );
        this.saveTable( relTbl, br );
      });

      // Finally, update any references in diffs.
      // TODO: This is slow and shit.
      const diffs = this.data.getIn( ['diffs'] );
      for( let ii = 0; ii < diffs.size; ++ii ) {
        const diff = diffs.get( ii );
        let newDiff = {
          id: [diff.id[0], diff.id[1]]
        };
        let changed = false;
        if( diff.id[0] == id ) {
          newDiff.id[0] = newId;
          changed = true;
        }
        if( diff.id[1] == id ) {
          newDiff.id[1] = newId;
          changed = true;
        }
        const relModel = this.getModel( getDiffId( diff )._type );
        for( const field of relModel.iterForeignKeys() ) {
          if( diff[field] ) {
            newDiff[field] = [diff[field][0], diff[field][1]];
            if( diff[field][0] && diff[field][0].equals( fromId ) ) {
              newDiff[field][0] = toId;
              changed = true;
            }
            if( diff[field][1] && diff[field][1].equals( fromId ) ) {
              newDiff[field][1] = toId;
              changed = true;
            }
          }
        }
        for( const field of relModel.iterManyToMany() ) {
          if( diff[field] ) {
            newDiff[field] = [diff[field][0], diff[field][1]];
            if( newDiff[field][0] && newDiff[field][0].has( fromId ) ) {
              newDiff[field][0] = newDiff[field][0].delete( fromId ).add( toId );
              changed = true;
            }
            if( newDiff[field][1] && newDiff[field][1].has( fromId ) ) {
              newDiff[field][1] = newDiff[field][1].delete( fromId ).add( toId );
              changed = true;
            }
          }
        }
        if( changed )
          this.data = this.data.updateIn( ['diffs', ii], x => Object( {...x, ...newDiff} ) );
      }
    }
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

      chain: new Map({
        diffs: new List(),
        current: 0
      })
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

  saveJson( filename ) {
    saveJson( this.data.toJS(), filename )
  }

  loadJson( file ) {
    return loadJson( file ).then( r => this.reset( r ) )
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
