import * as React from 'react';
const Autocomplete = require('react-autocomplete');
import * as classNames from 'classnames';

import { load } from '../../../schema.org';

interface AttributeNameProps {
  readonly attributeName?: string;
  readonly onChange?: (name: string) => void;
  readonly readOnly: boolean;
}

interface AttributeNameState {
  readonly menuIsOpen?: boolean;
  readonly schema?: any;
}

export class AttributeName extends React.Component<AttributeNameProps, AttributeNameState> {
  private autocomplete: any;

  // Render pre-bound callbacks
  setAutocompleteReference = (autocomplete: any) => this.autocomplete = autocomplete;
  onSelect = (value: string, item: any) => this.props.onChange(item);
  onChange = (event: any, value: string) => this.props.onChange(value);
  shouldItemRender = (item: string, value: string) => {
    return value && item.toLowerCase().includes(value.toLowerCase());
  }
  getItemValue = (_: any) => _
  sortItems = (a: any, b: any, value: string) => {
    if (a.startsWith(value)) {
      return -Infinity;
    }
    if (b.startsWith(value)) {
      return Infinity;
    }
    return a.indexOf(value[0]) - b.indexOf(value[0])
  }
  onMenuVisibilityChange = (menuIsOpen: boolean) => this.setState({menuIsOpen})

  constructor() {
    super(...arguments);
    this.state = {
      menuIsOpen: false
    };
  }

  componentDidMount() {
    load((schema: any) => this.setState({ schema }));
  }

  render() {
    if (!this.props.readOnly)
      return <Autocomplete
        ref={this.setAutocompleteReference}
        items={this.state.schema ? this.state.schema.types.CreativeWork.properties : []}
        value={this.props.attributeName}
        renderMenu={this.renderMenu}
        renderItem={this.renderMenuItem}
        onSelect={this.onSelect}
        onChange={this.onChange}
        sortItems={this.sortItems}
        getItemValue={this.getItemValue}
        shouldItemRender={this.shouldItemRender}
        wrapperProps={{className: 'autocomplete'}}
        inputProps={{className: classNames('input-text', this.state.menuIsOpen && 'open'), placeholder: 'Attribute Name'}}
        onMenuVisibilityChange={this.onMenuVisibilityChange}
      />;
    else
      return <input type="text" value={this.props.attributeName} readOnly />;
  }

  renderMenu = (children: any) => {
    return <ul className="menu">{children}</ul>;
  }

  renderMenuItem = (item: string, highlighted: boolean) => {
    const splits = item.split(new RegExp(`(${this.props.attributeName})`, 'i'));
    const matchedItem = splits.map((s, i) => <span key={i} className={classNames(this.shouldItemRender(s, this.props.attributeName) && 'matched')}>{s}</span>);

    return (
      <li key={item} className={classNames(highlighted && 'blur')}>
        { matchedItem }
      </li>
    );
  }


  public focus() {
    if (!this.props.readOnly)
      this.autocomplete.refs.input.focus();
  }
}