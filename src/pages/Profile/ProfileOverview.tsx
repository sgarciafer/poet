import * as React from 'react';

import ProfileComponent, { ProfileProps } from '../../components/ProfileComponent';

function render(props: ProfileProps) {
  return (
    <div className="col-sm-3">
      <div><img className="img-thumbnail mb-2" src={props.picture}/></div>
      <h3>{props.name}</h3>
      <div className="lead text-truncate mb-2">{props.publicKey}</div>
      <div className="blockquote mb-2">{props.bio}</div>
      <ul className="list-unstyled">
        { Object.keys(props.contacts).map(key => <li key={key}>{props.contacts[key]}</li>)}
      </ul>
    </div>
  )
}

export default ProfileComponent(render);