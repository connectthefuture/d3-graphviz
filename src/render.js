import * as Viz from "viz.js";
import * as d3 from "d3-selection";
import {transition, attrTween} from "d3-transition";

export default function(src, rootElement, transitionInstance, tweenPaths = true, keyMode = 'title') {

    function extractData(element, keyMode, index = 0) {

        var datum = {};
        var tag = element.node().nodeName;
        datum.tag = tag;
        datum.attributes = [];
        datum.children = [];
        var attributes = element.node().attributes;
        if (attributes) {
            for (var i = 0; i < attributes.length; i++) {
                var attribute = attributes[i];
                var name = attribute.name;
                var value = attribute.value;
                datum.attributes.push({'name': name, 'value': value});
            }
        }
        if (tag == '#text') {
            datum.text = element.text();
        } else if (tag == '#comment') {
            datum.comment = element.text();
        }
        var children = d3.selectAll(element.node().childNodes);
        if (keyMode == 'index') {
            datum.key = index;
        } else if (tag[0] != '#') {
            if (keyMode == 'id') {
                datum.key = element.attr('id');
            } else if (keyMode == 'title') {
                element.select('title');
                var title = element.select('title');
                if (!title.empty()) {
                    datum.key = element.select('title').text();
                }
            }
        }
        if (datum.key == null) {
            datum.key = tag + '-' + index;
        }
        var childTagIndexes = {};
        children.each(function () {
            if (this !== null) {
                var childTag = this.nodeName;
                if (childTagIndexes[childTag] == null) {
                    childTagIndexes[childTag] = 0;
                }
                var childIndex = childTagIndexes[childTag]++;
                var childData = extractData(d3.select(this), keyMode, childIndex);
                if (childData) {
                    datum.children.push(childData);
                }
            }
        });
        return datum;
    }

    function insertSvg(element, data) {
        var children = element.selectAll(function () {
            return element.node().childNodes;
        });
        children = children
          .data(data, function (d) {
              return d.key;
          });
        var childrenEnter = children
          .enter()
          .append(function(d) {
              if (d.tag == '#text') {
                  return document.createTextNode(d.text);
              } else if (d.tag == '#comment') {
                  return document.createComment(d.comment);
              } else {
                  return document.createElementNS('http://www.w3.org/2000/svg', d.tag);
              }
          });

        if (transitionInstance) {
            childrenEnter
                .filter(function(d) {
                    return d.tag[0] == '#' ? null : this;
                })
                .style("opacity", 0.0);
        }
        var childrenExit = children
          .exit();
        if (transitionInstance) {
            childrenExit = childrenExit
                .transition(transitionInstance);
            childrenExit
              .filter(function(d) {
                  return d.tag[0] == '#' ? null : this;
              })
                .style("opacity", 0.0);
        }
        childrenExit = childrenExit
            .remove()
        children = childrenEnter
            .merge(children);
        children.each(function(childData) {
            var child = d3.select(this);
            var childTransition = child;
            if (transitionInstance) {
                childTransition = childTransition
                    .transition(transitionInstance);
                childTransition
                  .filter(function(d) {
                      return d.tag[0] == '#' ? null : this;
                  })
                    .style("opacity", 1.0);
            }
            childData.attributes.forEach(function(attribute) {
                if (tweenPaths && transitionInstance && childData.tag == 'path' && attribute.name == 'd' && child.attr('d') != null) {
                    childTransition
                        .attrTween("d", pathTween(attribute.value, 4));
                } else {
                    childTransition
                        .attr(attribute.name, attribute.value);
                }
            });
            if (childData.text) {
                childTransition
                    .text(childData.text);
            }
            insertSvg(child, childData.children);
        });
    }

    function pathTween(d1, precision) {
        return function() {
            var path0 = this,
                path1 = path0.cloneNode(),
                n0 = path0.getTotalLength(),
                n1 = (path1.setAttribute("d", d1), path1).getTotalLength();

            // Uniform sampling of distance based on specified precision.
            var distances = [0], i = 0, dt = precision / Math.max(n0, n1);
            while ((i += dt) < 1) distances.push(i);
            distances.push(1);

            // Compute point-interpolators at each distance.
            var points = distances.map(function(t) {
                var p0 = path0.getPointAtLength(t * n0),
                    p1 = path1.getPointAtLength(t * n1);
                return d3.interpolate([p0.x, p0.y], [p1.x, p1.y]);
            });

            return function(t) {
                return t < 1 ? "M" + points.map(function(p) { return p(t); }).join("L") : d1;
            };
        };
    }

    var svgDoc = Viz(src,
              {
                  format: "svg",
                  engine: "dot"
              }
             );

    var newDoc = d3.select(document.createDocumentFragment())
      .append('div');

    newDoc
        .html(svgDoc);

    var newSvg = newDoc
      .select('svg');

    var data = extractData(newSvg, keyMode);

    var root = d3.select(rootElement);
    insertSvg(root, [data]);

};
