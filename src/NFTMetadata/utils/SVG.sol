//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {utils, LibString} from "./Utils.sol";

/// @notice Core SVG utility library which helps us construct onchain SVG's with a simple, web-like API.
/// @author Modified from (https://github.com/w1nt3r-eth/hot-chain-svg/blob/main/contracts/SVG.sol) by w1nt3r-eth.

library svg {
    /* GLOBAL CONSTANTS */
    string internal constant _SVG = 'xmlns="http://www.w3.org/2000/svg"';
    string internal constant _HTML = 'xmlns="http://www.w3.org/1999/xhtml"';
    string internal constant _XMLNS = "http://www.w3.org/2000/xmlns/ ";
    string internal constant _XLINK = "http://www.w3.org/1999/xlink ";

    /* MAIN ELEMENTS */
    function g(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("g", _props, _children);
    }

    function _svg(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("svg", string.concat(_SVG, " ", _props), _children);
    }

    function style(string memory _title, string memory _props) internal pure returns (string memory) {
        return el("style", string.concat(".", _title, " ", _props));
    }

    function path(string memory _d) internal pure returns (string memory) {
        return el("path", prop("d", _d, true));
    }

    function path(string memory _d, string memory _props) internal pure returns (string memory) {
        return el("path", string.concat(prop("d", _d), _props));
    }

    function path(string memory _d, string memory _props, string memory _children)
        internal
        pure
        returns (string memory)
    {
        return el("path", string.concat(prop("d", _d), _props), _children);
    }

    function text(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("text", _props, _children);
    }

    function line(string memory _props) internal pure returns (string memory) {
        return el("line", _props);
    }

    function line(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("line", _props, _children);
    }

    function circle(string memory _props) internal pure returns (string memory) {
        return el("circle", _props);
    }

    function circle(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("circle", _props, _children);
    }

    function circle(string memory cx, string memory cy, string memory r) internal pure returns (string memory) {
        return el("circle", string.concat(prop("cx", cx), prop("cy", cy), prop("r", r, true)));
    }

    function circle(string memory cx, string memory cy, string memory r, string memory _children)
        internal
        pure
        returns (string memory)
    {
        return el("circle", string.concat(prop("cx", cx), prop("cy", cy), prop("r", r, true)), _children);
    }

    function circle(string memory cx, string memory cy, string memory r, string memory _props, string memory _children)
        internal
        pure
        returns (string memory)
    {
        return el("circle", string.concat(prop("cx", cx), prop("cy", cy), prop("r", r), _props), _children);
    }

    function ellipse(string memory _props) internal pure returns (string memory) {
        return el("ellipse", _props);
    }

    function ellipse(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("ellipse", _props, _children);
    }

    function polygon(string memory _props) internal pure returns (string memory) {
        return el("polygon", _props);
    }

    function polygon(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("polygon", _props, _children);
    }

    function polyline(string memory _props) internal pure returns (string memory) {
        return el("polyline", _props);
    }

    function polyline(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("polyline", _props, _children);
    }

    function rect(string memory _props) internal pure returns (string memory) {
        return el("rect", _props);
    }

    function rect(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("rect", _props, _children);
    }

    function filter(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("filter", _props, _children);
    }

    function cdata(string memory _content) internal pure returns (string memory) {
        return string.concat("<![CDATA[", _content, "]]>");
    }

    /* GRADIENTS */
    function radialGradient(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("radialGradient", _props, _children);
    }

    function linearGradient(string memory _props, string memory _children) internal pure returns (string memory) {
        return el("linearGradient", _props, _children);
    }

    function gradientStop(uint256 offset, string memory stopColor, string memory _props)
        internal
        pure
        returns (string memory)
    {
        return el(
            "stop",
            string.concat(
                prop("stop-color", stopColor),
                " ",
                prop("offset", string.concat(LibString.toString(offset), "%")),
                " ",
                _props
            ),
            utils.NULL
        );
    }

    /* ANIMATION */
    function animateTransform(string memory _props) internal pure returns (string memory) {
        return el("animateTransform", _props);
    }

    function animate(string memory _props) internal pure returns (string memory) {
        return el("animate", _props);
    }

    /* COMMON */
    // A generic element, can be used to construct any SVG (or HTML) element
    function el(string memory _tag, string memory _props, string memory _children)
        internal
        pure
        returns (string memory)
    {
        return string.concat("<", _tag, " ", _props, ">", _children, "</", _tag, ">");
    }

    // A generic element, can be used to construct SVG (or HTML) elements without children
    function el(string memory _tag, string memory _props) internal pure returns (string memory) {
        return string.concat("<", _tag, " ", _props, "/>");
    }

    // an SVG attribute
    function prop(string memory _key, string memory _val) internal pure returns (string memory) {
        return string.concat(_key, "=", '"', _val, '" ');
    }

    function prop(string memory _key, string memory _val, bool last) internal pure returns (string memory) {
        if (last) {
            return string.concat(_key, "=", '"', _val, '"');
        } else {
            return string.concat(_key, "=", '"', _val, '" ');
        }
    }
}
