import React, {Component} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

import * as modelActions from '../actions'
import DB from '../db'

/**
 *
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const {name, schema} = options || {}
      const {model = {}} = state
      const db = schema.db( model.db )
      const trans = db.getTransaction( name )
      return {
        originalDB: db,
        db: trans,
        sync: model.sync
      }
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class TransactionComponent extends Component {

      constructor( props ) {
        super( props )
        this.startTransaction = ::this.startTransaction
        this.commitTransaction = ::this.commitTransaction
        this.abortTransaction = ::this.abortTransaction
        this.sync = ::this.sync
        this.commit = ::this.commit
      }

      startTransaction( props ) {
        const {originalDB: db} = props
        const {name} = options || {}
        if( !db.getTransaction( name ) ) {
          console.debug( `TransactionComponent: start transaction "${name}".` )
          props.startTransaction( {schema, name} )
        }
      }

      commitTransaction( opts={} ) {
        const {schema, name} = options || {}
        const {sync} = opts
        console.debug( `TransactionComponent: commit transaction "${name}".` )
        this.props.commitTransaction( {schema, name} )
        /* if( sync )
         *   this.props.sync( {schema} )*/
      }

      abortTransaction() {
        const {originalDB: db} = this.props
        const {schema, name} = options || {}
        if( db.getTransaction( name ) ) {
          this.props.abortTransaction( {schema, name} )
          console.debug( `TransactionComponent: abort transaction "${name}".` )
        }
      }

      componentWillMount() {
        const {loading} = this.props
        if( !loading ) {
          this.startTransaction( this.props )
        }
      }

      componentWillReceiveProps( nextProps ) {
        const {loading} = nextProps
        if( !loading ) {
          this.startTransaction( nextProps )
        }
      }

      componentWillUnmount() {
        this.abortTransaction( this.props )
      }

      sync() {
        const {schema} = options || {}
        return this.props.sync( {schema} )
      }

      commit() {
        const {schema} = options || {}
        this.props.commit( {schema} )
      }

      render() {
        const {db, loading} = this.props
        const {schema, name} = options || {}
        return (
          <ComposedComponent
            {...this.props}
            loading={!db || loading}
            saveTransaction={() => this.props.saveTransaction( {schema, db} )}
            commitTransaction={this.commitTransaction}
            abortTransaction={this.abortTransaction}
            loadJsonApiResponse={data => this.props.loadJsonApiResponse( {schema, data} )}
            sync={this.sync}
            commit={this.commit}
          />
        )
      }
    }
  );
}
