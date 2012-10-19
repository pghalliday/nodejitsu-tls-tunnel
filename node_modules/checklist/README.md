node-checklist
===============

A simple Node.js checklist for synchronising asynchronous tasks by maintaining a list of items to check off before calling back.

## Features

- should callback immediately if there are no items to check off
- should callback once all the items have been checked off
- should callback with an error if an item is checked off that we are not waiting for
- should callback with an error if an item is checked off twice
- should callback with an error if an item is checked off out of order and ordered has been set to true
- should not callback again after error
- should throw an error if checked again after completion

## Installation

```
npm install checklist
```

## API

```javascript
var Checklist = require('checklist');

var testItem = {
  test: 'hello'
};

var checklist = new Checklist([
  'item 1',
  testItem,
  'item 2'
], {
  ordered: true, // Set to true to error if items are checked out of order (defaults to false)
  debug: true    // Set to true to print each item to the console as it is checked off (defaults to false);
}, function(error) {
  if (error) {
    // A problem occurred
  } else {
    // Everything in the list was checked off
  }
});

checklist.check('item 1');
checklist.check(testItem);
checklist.check('item 2');
```

## Roadmap

- should allow more items to be added after construction

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using ``./grunt.sh`` or ``.\grunt.bat``.

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Peter Halliday  
Licensed under the MIT license.