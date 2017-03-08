import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import * as modelActions from '../actions';
import DB from '../db';

/**
 *
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const {name, schema} = options || {};
      const {model = {}} = state;
      const db = schema.db( model.db );
      const trans = db.getTransaction( name );
      return {
        originalDB: db,
        db: trans
      };
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class TransactionComponent extends Component {

      constructor( props ) {
        super( props );
        this.startTransaction = ::this.startTransaction;
        this.commitTransaction = ::this.commitTransaction;
        this.abortTransaction = ::this.abortTransaction;
      }

      startTransaction( props ) {
        const {originalDB: db} = props;
        const {name} = options || {};
        if( !db.getTransaction( name ) ) {
          console.debug( `TransactionComponent: start transaction "${name}".` );
          props.startTransaction( name );
        }
      }

      commitTransaction() {
        const {schema, name} = options || {};
        console.debug( `TransactionComponent: commit transaction "${name}".` );
        this.props.commitTransaction( {schema, name} );
        this.props.sync( {schema} );
      }

      abortTransaction( props ) {
        const {originalDB: db} = props;
        const {schema, name} = options || {};
        if( db.getTransaction( name ) ) {
          props.abortTransaction( {schema, name} );
          console.debug( `TransactionComponent: abort transaction "${name}".` );
        }
      }

      componentWillMount() {
        this.startTransaction( this.props );
      }

      /* componentWillReceiveProps( nextProps ) {
       *     this.startTransaction( nextProps );
       * }*/

      componentWillUnmount() {
        this.abortTransaction( this.props );
      }

      render() {
        const {db} = this.props;
        const {schema, name} = options || {};
        if( db ) {
          return <ComposedComponent
                     {...this.props}
                     saveTransaction={() => this.props.saveTransaction( {schema, db} )}
                     commitTransaction={this.commitTransaction}
                     loadJsonApiResponse={data => this.props.loadJsonApiResponse( {schema, data} )}
                 />;
        }
        else
          return null;
      }
    }
  );
}
