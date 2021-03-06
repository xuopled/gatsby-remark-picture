require(`gatsby/dist/redux/actions`)

const visit = require(`unist-util-visit`)
const path = require(`path`)
const isRelativeUrl = require(`is-relative-url`)
const {fluid} = require(`gatsby-plugin-sharp`)
const slash = require(`slash`)
const Promise = require(`bluebird`)

module.exports = (
  {files, markdownNode, markdownAST, getNode, reporter},
  pluginOptions
) => {
  const getResponsiveSources = async function(node, resolve, reject) {
    const folderNode = getNode(markdownNode.parent)

    if (!folderNode || !folderNode.dir) {
      resolve()
    }

    const imagePath = slash(path.join(folderNode.dir, node.url))
    const imageNode = files.find(
      file => file && file.absolutePath && file.absolutePath === imagePath
    )

    if (typeof imageNode === undefined) {
      resolve()
    }

    const source = await fluid({
      file: imageNode,
      reporter,
    })

    const sourceWebp =
      pluginOptions.withSourceWebp &&
      (await fluid({
        file: imageNode,
        args: {toFormat: `WEBP`},
        reporter,
      }))

    return {source, sourceWebp}
  }

  let markdownImageNodes = []

  visit(markdownAST, `image`, (node, index, parent) => {
    markdownImageNodes.push(node)
  })

  return Promise.all(
    markdownImageNodes.map(
      node =>
        new Promise(async (resolve, reject) => {
          if (isRelativeUrl(node.url)) {
            const {source, sourceWebp} = await getResponsiveSources(
              node,
              resolve,
              reject
            )

            const imageNode = Object.assign(
              {},
              node,
              source
                ? {
                    data: {
                      ...(node.data ? node.data : {}),
                      hProperties: {
                        ...(node.data && node.data.hProperties
                          ? node.data.hProperties
                          : {}),
                        src: source.src,
                        srcset: source.srcSet,
                        sizes: source.sizes,
                      },
                    },
                  }
                : {}
            )

            const sourceNode = pluginOptions.withSource &&
              source && {
                type: "paragraph",
                data: {
                  hName: "source",
                  hProperties: {
                    srcset: source.srcSet,
                    sizes: source.sizes,
                    type: source.srcSetType,
                  },
                },
              }

            const sourceWebpNode = sourceWebp && {
              type: "paragraph",
              data: {
                hName: "source",
                hProperties: {
                  srcset: sourceWebp.srcSet,
                  sizes: sourceWebp.sizes,
                  type: sourceWebp.srcSetType,
                },
              },
            }

            node.type = "paragraph"
            node.data = {
              hName: "picture",
              hProperties: {
                ...(pluginOptions.className
                  ? {className: pluginOptions.className}
                  : {}),
              },
            }

            node.children = [
              ...(sourceWebpNode ? [sourceWebpNode] : []),
              ...(sourceNode ? [sourceNode] : []),
              imageNode,
            ]

            resolve(node)
          } else {
            resolve()
          }
        })
    )
  )
}
