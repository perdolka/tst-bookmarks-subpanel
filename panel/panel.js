/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '/common/constants.js';

import * as Connection from './connection.js';
import * as EventUtils from './event-utils.js';
import * as Bookmarks from './bookmarks.js';
import * as Dialogs from './dialogs.js';
import './context-menu.js';
import './drag-and-drop.js';
import './keyboard-navigation.js';
import './searchbar.js';

let mInitiaized = false;

const configs = Connection.getConfigs([
  'openedFolders',
  'openInTabAlways',
  'scrollPosition',
  'openAsActiveTab',
  'showScrollbarLeft'
]);

const mSearchBox = document.getElementById('searchbox');
const mContent = document.getElementById('content');
const mRoot = document.getElementById('root');

async function init() {
  if (mInitiaized)
    return;
  try {
    await Promise.all([
      Bookmarks.init(),
      configs.$loaded
    ]);

    mContent.scrollTop = configs.scrollPosition;

    configs.$addObserver(onConfigChange);
    onConfigChange('showScrollbarLeft')

    mInitiaized = true;
  }
  catch(_error) {
  }
}

init();

function onConfigChange(key) {
  switch (key) {
    case 'showScrollbarLeft':
      if (configs.showScrollbarLeft)
        document.documentElement.classList.add('left-scrollbar');
      else
        document.documentElement.classList.remove('left-scrollbar');
      break;
  }
}


let mLastMouseDownTarget = null;

mContent.addEventListener('mousedown', event => {
  const item = EventUtils.getItemFromEvent(event);
  if (!item)
    return;

  mLastMouseDownTarget = item.raw.id;

  if (!EventUtils.getElementTarget(event).classList.contains('twisty'))
    Bookmarks.setActive(item, {
      multiselect: item.classList.contains('highlighted') && mRoot.querySelectorAll('li.highlighted').length > 1
    });

  if (event.button == 1) {
    // We need to cancel mousedown to block the "auto scroll" behavior
    // of Firefox itself.
    event.stopPropagation();
    event.preventDefault();
  }

  if (event.button == 2 ||
      (event.button == 0 &&
       event.ctrlKey)) {
    // context menu
    return;
  }
}, { capture: true });

// We need to handle mouseup instead of click to bypass the "auto scroll"
// behavior of Firefox itself.
mContent.addEventListener('mouseup', event => {
  if (event.button == 2)
    return;

  const item = EventUtils.getItemFromEvent(event);
  if (!item)
    return;

  if (mLastMouseDownTarget != item.raw.id) {
    mLastMouseDownTarget = null;
    return;
  }

  mLastMouseDownTarget = null;

  const accel = event.ctrlKey || event.metaKey || event.button == 1;

  if (item.classList.contains('folder')) {
    if (accel || event.shiftKey) {
      const urls = item.raw.children.map(item => item.url).filter(url => url && Constants.LOADABLE_URL_MATCHER.test(url));
      Dialogs.warnOnOpenTabs(urls.length).then(granted => {
        if (!granted)
          return;
        Connection.sendMessage({
          type: Constants.COMMAND_OPEN_BOOKMARKS,
          urls,
          inWindow: event.shiftKey
        });
      });
    }
    else {
      Bookmarks.toggleOpenState(item);
      if (!EventUtils.getElementTarget(event).classList.contains('twisty'))
        Bookmarks.setActive(item);
    }
    return;
  }

  if (item.classList.contains('bookmark') &&
      !item.classList.contains('unavailable')) {
    if (event.shiftKey)
      Connection.sendMessage({
        type:     Constants.COMMAND_OPEN_BOOKMARKS,
        urls:     [item.raw.url],
        inWindow: true
      });
    else if (!configs.openInTabAlways)
      Connection.sendMessage({
        type: Constants.COMMAND_LOAD_BOOKMARK,
        url:  item.raw.url
      });
    else
      Connection.sendMessage({
        type:       Constants.COMMAND_OPEN_BOOKMARKS,
        urls:       [item.raw.url],
        background: !configs.openAsActiveTab
      });
    return;
  }
});

mContent.addEventListener('scroll', () => {
  Connection.sendMessage({
    type:   Constants.COMMAND_SET_CONFIGS,
    values: {
      scrollPosition: mContent.scrollTop
    }
  });
});

window.addEventListener('focus', () => {
  setTimeout(() => {
    if (!mSearchBox.matches(':focus'))
      mRoot.classList.add('active');
  }, 0);
});

window.addEventListener('blur', () => {
  mRoot.classList.remove('active');
});
