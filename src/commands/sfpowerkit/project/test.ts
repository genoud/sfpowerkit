import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import DiffUtil from "../../../shared/diffutils";
import * as path from 'path'
import { MetadataInfoUtils, SOURCE_EXTENSION_REGEX } from "../../../shared/metadataInfo";
import { SfPowerKit } from "../../../shared/sfpowerkit";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "project_diff"
);

export default class Test extends SfdxCommand {
  public static description = messages.getMessage(
    "commandDescription"
  );

  public static examples = [
    `$ sfdx sfpowerkit:project:diff --diffFile DiffFileName --encoding EncodingOfFile --output OutputFolder
    {
      "status": 0,
      "result": {
        "deleted": [],
        "addedEdited": [
          "scripts\\Alias.sh",
          "sfdx-project.json",
        ]
       }
      }`,
    `$ sfdx sfpowerkit:project:diff --revisionfrom revisionfrom --revisionto revisionto --output OutputFolder
   {
    "status": 0,
    "result": {
      "deleted": [],
      "addedEdited": [
        "scripts\\Alias.sh",
        "sfdx-project.json",
      ]
     }
    }
   `
  ];

  protected static flagsConfig: FlagsConfig = {
    difffile: flags.string({ char: 'f', description: messages.getMessage('diffFileDescription'), required: false }),
    encoding: flags.string({ char: 'e', description: messages.getMessage('encodingDescription'), required: false }),
    revisionfrom: flags.string({ char: 'r', description: messages.getMessage('revisionFromDescription'), required: false }),
    revisionto: flags.string({ char: 't', description: messages.getMessage('revisionToDescription'), required: false })
  };
  protected static requiresUsername = false;
  protected static requiresProject = false;

  public async run(): Promise<any> {
    SfPowerKit.ux=this.ux;
    let metadataName=MetadataInfoUtils.getMetadataName("ccare-ihm\\force-app\\ihm\\email\\DACH.approvalProcess-meta.xml");
    this.ux.log(metadataName)
    let filePath = "DC_Brand.Biotherm_Homme.md-meta.xml"
    this.ux.log(filePath.replace(SOURCE_EXTENSION_REGEX,''))
  }
}
