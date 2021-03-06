// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {injectIntl, intlShape} from 'react-intl';
import {
    NetInfo,
    Platform,
    View
} from 'react-native';

import EventEmitter from 'mattermost-redux/utils/event_emitter';

import ChannelDrawer from 'app/components/channel_drawer';
import ChannelLoader from 'app/components/channel_loader';
import KeyboardLayout from 'app/components/layout/keyboard_layout';
import Loading from 'app/components/loading';
import OfflineIndicator from 'app/components/offline_indicator';
import PostListRetry from 'app/components/post_list_retry';
import StatusBar from 'app/components/status_bar';
import {wrapWithPreventDoubleTap} from 'app/utils/tap';
import {makeStyleSheetFromTheme} from 'app/utils/theme';
import PostTextbox from 'app/components/post_textbox';

import ChannelDrawerButton from './channel_drawer_button';
import ChannelPostList from './channel_post_list';
import ChannelSearchButton from './channel_search_button';
import ChannelTitle from './channel_title';

class Channel extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            connection: PropTypes.func.isRequired,
            loadChannelsIfNecessary: PropTypes.func.isRequired,
            loadProfilesAndTeamMembersForDMSidebar: PropTypes.func.isRequired,
            markChannelAsRead: PropTypes.func.isRequired,
            selectFirstAvailableTeam: PropTypes.func.isRequired,
            selectInitialChannel: PropTypes.func.isRequired,
            initWebSocket: PropTypes.func.isRequired,
            closeWebSocket: PropTypes.func.isRequired,
            startPeriodicStatusUpdates: PropTypes.func.isRequired,
            stopPeriodicStatusUpdates: PropTypes.func.isRequired,
            viewChannel: PropTypes.func.isRequired
        }).isRequired,
        intl: intlShape.isRequired,
        navigator: PropTypes.object,
        currentTeamId: PropTypes.string,
        currentChannelId: PropTypes.string,
        theme: PropTypes.object.isRequired,
        channelsRequestFailed: PropTypes.bool
    };

    componentWillMount() {
        EventEmitter.on('leave_team', this.handleLeaveTeam);
        NetInfo.isConnected.addEventListener('connectionChange', this.handleConnectionChange);
        NetInfo.isConnected.fetch().then(this.handleConnectionChange);

        if (this.props.currentTeamId) {
            this.loadChannels(this.props.currentTeamId);
        }
    }

    componentDidMount() {
        // Mark current channel as read when opening app while logged in
        if (this.props.currentChannelId) {
            this.props.actions.markChannelAsRead(this.props.currentChannelId);
            this.props.actions.viewChannel(this.props.currentChannelId);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.currentTeamId && this.props.currentTeamId !== nextProps.currentTeamId) {
            this.loadChannels(nextProps.currentTeamId);
        }
    }

    componentWillUnmount() {
        const {closeWebSocket, stopPeriodicStatusUpdates} = this.props.actions;

        EventEmitter.off('leave_team', this.handleLeaveTeam);
        NetInfo.isConnected.removeEventListener('connectionChange', this.handleConnectionChange);

        closeWebSocket();
        stopPeriodicStatusUpdates();
    }

    attachPostTextbox = (ref) => {
        this.postTextbox = ref;
    };

    blurPostTextBox = () => {
        this.postTextbox.getWrappedInstance().getWrappedInstance().blur();
    };

    goToChannelInfo = wrapWithPreventDoubleTap(() => {
        const {intl, navigator, theme} = this.props;
        const options = {
            screen: 'ChannelInfo',
            title: intl.formatMessage({id: 'mobile.routes.channelInfo', defaultMessage: 'Info'}),
            animated: true,
            backButtonTitle: '',
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            }
        };

        if (Platform.OS === 'android') {
            navigator.showModal(options);
        } else {
            navigator.push(options);
        }
    });

    handleConnectionChange = (isConnected) => {
        const {actions} = this.props;
        const {
            closeWebSocket,
            connection,
            initWebSocket,
            startPeriodicStatusUpdates,
            stopPeriodicStatusUpdates
        } = actions;

        if (isConnected) {
            initWebSocket(Platform.OS);
            startPeriodicStatusUpdates();
        } else {
            closeWebSocket(true);
            stopPeriodicStatusUpdates();
        }
        connection(isConnected);
    };

    handleLeaveTeam = () => {
        this.props.actions.selectFirstAvailableTeam();
    };

    loadChannels = (teamId) => {
        const {
            loadChannelsIfNecessary,
            loadProfilesAndTeamMembersForDMSidebar,
            selectInitialChannel
        } = this.props.actions;

        loadChannelsIfNecessary(teamId).then(() => {
            loadProfilesAndTeamMembersForDMSidebar(teamId);
            return selectInitialChannel(teamId);
        }).catch(() => {
            return selectInitialChannel(teamId);
        });
    };

    retryLoadChannels = () => {
        this.loadChannels(this.props.currentTeamId);
    };

    render() {
        const {
            channelsRequestFailed,
            currentChannelId,
            intl,
            navigator,
            theme
        } = this.props;

        const style = getStyleFromTheme(theme);

        if (!currentChannelId) {
            if (channelsRequestFailed) {
                return (
                    <PostListRetry
                        retry={this.retryLoadChannels}
                        theme={theme}
                    />
                );
            }
            return (
                <View style={style.loading}>
                    <Loading/>
                </View>
            );
        }

        return (
            <ChannelDrawer
                blurPostTextBox={this.blurPostTextBox}
                intl={intl}
                navigator={navigator}
            >
                <StatusBar/>
                <View>
                    <OfflineIndicator/>
                    <View style={style.header}>
                        <ChannelDrawerButton/>
                        <ChannelTitle onPress={this.goToChannelInfo}/>
                        <ChannelSearchButton
                            navigator={navigator}
                            theme={theme}
                        />
                    </View>
                </View>
                <KeyboardLayout
                    behavior='padding'
                    style={style.keyboardLayout}
                >
                    <View style={style.postList}>
                        <ChannelPostList navigator={navigator}/>
                    </View>
                    <ChannelLoader theme={theme}/>
                    <PostTextbox
                        ref={this.attachPostTextbox}
                        navigator={navigator}
                    />
                </KeyboardLayout>
            </ChannelDrawer>
        );
    }
}

const getStyleFromTheme = makeStyleSheetFromTheme((theme) => {
    return {
        header: {
            backgroundColor: theme.sidebarHeaderBg,
            flexDirection: 'row',
            justifyContent: 'flex-start',
            width: '100%',
            zIndex: 10,
            ...Platform.select({
                android: {
                    height: 46
                },
                ios: {
                    height: 64,
                    paddingTop: 20
                }
            })
        },
        postList: {
            flex: 1
        },
        loading: {
            backgroundColor: theme.centerChannelBg,
            flex: 1
        },
        keyboardLayout: {
            backgroundColor: theme.centerChannelBg,
            flex: 1,
            zIndex: -1,
            paddingBottom: 0
        }
    };
});

export default injectIntl(Channel);
