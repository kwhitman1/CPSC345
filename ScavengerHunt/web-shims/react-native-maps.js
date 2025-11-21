const React = require('react');
const { View, Text } = require('react-native');

// Minimal shim that mimics react-native-maps API surface used in this project.
function MapView({ children, style }) {
  return React.createElement(View, { style }, React.createElement(Text, null, 'Map placeholder (web)'));
}

function Marker({ coordinate, title, pinColor }) {
  // Render nothing or a simple placeholder
  return React.createElement(View, { style: { display: 'none' } });
}

module.exports = {
  default: MapView,
  Marker,
};
