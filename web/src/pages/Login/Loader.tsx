import * as React from 'react';
import { Route } from 'react-router';

import { Actions } from '../../actions/index';
import PageLoader, { ReducerDescription } from '../../components/PageLoader';
import { LoginLayout, LoginLayoutProps } from './Layout';

interface LoginState {
}

export class Login extends PageLoader<LoginState, Object> {

  component = LoginLayout;

  initialState() {
    return {};
  }

  routeHook(key: string) {
    return [<Route path="/login" key={key} component={this.container()} />]
  }

  reducerHook<State>(): ReducerDescription<LoginState> {
    return null;
  }

  sagaHook(): any {
    return null;
  }

  select(state: any, ownProps: any): LoginLayoutProps {
    return {
      requestId: state.session.requestId
    }
  }

  mapDispatchToProps() {
    return {
      loginButtonClickedAction: () => ({ type: Actions.Session.LoginButtonClicked }),
      mockLoginRequest: (requestId: string) => ({ type: Actions.Session.MockLoginRequest, payload: requestId })
    }
  }
}
