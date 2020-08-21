/* eslint max-len: 0 */

import React from 'react';
import PropTypes from 'prop-types';

import find from 'lodash/find';

import {getAssetReferences, getTags, getTerms} from '../utils';

export default class ViewItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            references: null
        };

        const me = this;
        getAssetReferences(this.props.asset.id).then(function(data) {
            if ('references' in data) {
                me.setState({references: data['references']});
            }
        });
    }
    render() {
        let authorId = null;
        if (this.props.asset && this.props.asset.author) {
            authorId = this.props.asset.author.id;
        }

        let userIsAuthor = false;
        if (window.MediaThread && window.MediaThread.current_user) {
            userIsAuthor = authorId === window.MediaThread.current_user;
        }

        const references = [];
        if (this.state.references) {
            this.state.references.forEach(function(reference, idx) {
                references.push(
                    <li key={idx}>
                        <a href={reference.url}>{reference.title}</a>
                    </li>
                );
            });
        }

        let tags = 'There are no tags.';
        let terms = 'There are no terms.';
        if (this.props.asset && this.props.asset.annotations) {
            const tagsArray = getTags(this.props.asset.annotations);
            if (tagsArray.length > 0) {
                tags = tagsArray.join(', ');
            }

            const termsArray = getTerms(this.props.asset.annotations);
            if (termsArray.length > 0) {
                terms = termsArray.join(', ');
            }
        }

        let description = null;
        if (this.props.asset && this.props.asset.metadata) {
            let desc = find(this.props.asset.metadata, {key: 'Description'});
            if (desc) {
                desc = desc.value;
            }
            if (desc && desc.length) {
                description = desc[0];
            }
        }

        return (
            <div className="tab-content" id="pills-tabContent">
                <h3>Tags</h3>
                <p>
                    {tags}
                </p>

                <hr />

                <h3>Terms</h3>
                <p>
                    {terms}
                </p>

                <hr />

                <h3>Course References</h3>
                {this.state.references && this.state.references.length === 0 && (
                    <div>There are no references in this course.</div>
                )}

                {this.state.references && this.state.references.length > 0 && (
                    <ul>
                        {references}
                    </ul>
                )}

                <hr />

                <h3>Additional Information (Metadata)</h3>
                <table className="table table-sm table-borderless mt-1 table-metadata">
                    <tbody>
                        <tr>
                            <th scope="row">Item Name</th>
                            <td>
                                {this.props.asset.title}
                                &nbsp;
                                {userIsAuthor && (
                                    <button type="submit" className="btn btn-secondary btn-sm">
                                        Rename
                                    </button>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Permalink</th>
                            <td>
                                <a href="">
                                    {window.location.href}
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Creator</th>
                            <td>
                                {this.props.asset.author.public_name} ({this.props.asset.author.username})
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p>
                    {description}
                </p>

                <button type="submit" className="btn btn-danger btn-sm float-right">
                    Remove from my Collection
                </button>
            </div>
        );

    }
}

ViewItem.propTypes = {
    asset: PropTypes.object
};
