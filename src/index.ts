
import { dag, Directory, File, object, func, GitRef } from "@dagger.io/dagger"
import * as yaml from "js-yaml"

@object()
export class TwCombobulator {
  /**
   * The main pipeline entry point for combobulating TiddlyWiki sources.
   * @param config The configuration file defining the layers.
   */
  @func()
  async combobulate(config: File): Promise<File> {
    // 1. Parse the YAML configuration
    const configContent = await config.contents()
    const parsedConfig: any = yaml.load(configContent)

    if (!parsedConfig.layers || !Array.isArray(parsedConfig.layers)) {
      throw new Error("Invalid config: 'layers' array not found.")
    }

    // 2. Reverse the list to process from bottom to top
    const reversedLayers = parsedConfig.layers.reverse()

    // 3. Initialize the base directory for merging
    let state = dag.directory()

    // 4. Process each layer
    for (const layer of reversedLayers) {
      console.log(`Processing layer: ${layer.source}`)

      // Fetch the source directory
      let sourceDir = await this.getWikiSource(layer.source)

      // Handle exclusions if they exist
      if (layer.exclude && layer.exclude.length > 0) {
        const exclusionFilter = layer.exclude
          .map((t: string) => `"[title[${t}]]"`)
          .join(" ")

        console.log(`Excluding tiddlers: ${exclusionFilter}`)
        
        sourceDir = this.tiddlywikiContainer()
          .withDirectory("/src", sourceDir)
          .withWorkdir("/src")
          .withExec(["deletetiddlers", exclusionFilter])
          .directory(".")
      }

      // Merge the processed layer into the main state
      state = state.withDirectory(".", sourceDir)
    }

    // 5. Final build step
    console.log("Building final index.html...")
    const finalWiki = this.tiddlywikiContainer()
      .withDirectory("/src", state)
      .withWorkdir("/src")
      .withExec(["--build", "index"])
      .file("output/index.html")

    return finalWiki
  }

  /**
   * Fetches a TiddlyWiki source and returns it as a Dagger Directory.
   * @param source A URL to a git repo, a remote HTML file, or a local path.
   */
  @func()
  async getWikiSource(source: string): Promise<Directory> {
    // Case 1: Git Repository
    if (source.endsWith(".git") || source.includes("github.com")) {
      console.log(`Fetching from Git: ${source}`)
      return dag.git(source).branch("master").tree()
    }
    
    // Case 2: Remote HTML File
    if (source.startsWith("http")) {
      console.log(`Fetching from URL: ${source}`)
      const downloadedFile = dag.http(source)
      
      // "Explode" the HTML file into a directory of tiddlers
      return this.tiddlywikiContainer()
        .withFile("/src/index.html", downloadedFile)
        .withWorkdir("/src")
        .withExec(["--load", "index.html", "--savewikifolder", "./dist"])
        .directory("./dist")
    }

    // Case 3: Local Directory
    console.log(`Fetching from local path: ${source}`)
    return dag.host().directory(source)
  }

  /**
   * Helper function to create a standardized TiddlyWiki container.
   */
  private tiddlywikiContainer() {
    return dag
      .container()
      .from("node:18-alpine")
      .withExec(["npm", "install", "-g", "tiddlywiki"])
      .withEntrypoint(["tiddlywiki"])
  }
}
