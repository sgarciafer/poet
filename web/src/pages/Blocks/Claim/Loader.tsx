import * as React from 'react'
import { Route } from 'react-router'
import { Saga } from 'redux-saga'

import PageLoader, { ReducerDescription } from '../../../components/PageLoader'
import ClaimLayout from './Layout'

export class Claim extends PageLoader<Object, Object> {

  component = ClaimLayout;

  initialState() {
    return {};
  }

  routeHook(key: string) {
    return [<Route path="/claims/:id" key={key} component={this.container()} />]
  }

  reducerHook<State>(): ReducerDescription<null> {
    return null;
  }

  sagaHook(): Saga {
    return null;
  }

  select(state: any, ownProps: any): Object {
    return { id: ownProps.params.id };
  }

  mapDispatchToProps(): Object {
    return null;
  }
}