/**
 * TEST-ONLY HELPER — do not import from production code.
 *
 * Produces a minimal MS-SHLLINK formatted .lnk Buffer that the
 * @recent-cli/resolve-lnk parser will accept. We use this in tests instead
 * of committing binary fixture files, which are awkward to create on macOS
 * and review in PRs.
 *
 * Layout (offsets):
 *   0..76   ShellLinkHeader
 *           - HeaderSize (4)         = 0x4C (76)
 *           - LinkCLSID (16)         = 00021401-0000-0000-C000-000000000046
 *           - LinkFlags (4) at 20    = HasLinkTargetIDList | HasLinkInfo (0x3)
 *           - rest: zeros
 *   76..78  LinkTargetIDList: IDListSize = 2
 *   78..80  LinkTargetIDList: empty IDList terminator (0x0000)
 *   80..    LinkInfo block (size in first 4 bytes)
 *
 * The library reads target as `LocalBasePath + CommonPathSuffix`. If
 * LinkInfoHeaderSize > 28 it overrides LocalBasePath with
 * LocalBasePathUnicode; if > 32 it overrides CommonPathSuffix with
 * CommonPathSuffixUnicode. We point CommonPathSuffixOffset at a NUL byte
 * (and the unicode counterpart at NUL,NUL) so the suffix reads as empty
 * and the recovered string is just the LocalBasePath.
 */
export function buildMinimalLnk(targetPath: string, encoding: 'ascii' | 'utf16le'): Buffer {
  const header = Buffer.alloc(76);
  header.writeInt32LE(76, 0); // HeaderSize
  // LinkCLSID = {00021401-0000-0000-C000-000000000046}
  Buffer.from([
    0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46,
  ]).copy(header, 4);
  // LinkFlags: HasLinkTargetIDList (0x1) | HasLinkInfo (0x2)
  header.writeInt32LE(0x3, 20);

  // LinkTargetIDList: just the terminator
  const idListSize = Buffer.from([0x02, 0x00]); // 2 bytes
  const idListTerm = Buffer.from([0x00, 0x00]);

  // LinkInfo block
  const useUnicode = encoding === 'utf16le';
  const headerSize = useUnicode ? 36 : 28;

  // ASCII LocalBasePath segment.
  // - For ASCII fixtures: the real path + NUL terminator.
  // - For Unicode fixtures: just a NUL byte placeholder (the parser will
  //   override d with the utf16 LocalBasePathUnicode when LinkInfoHeaderSize
  //   > 28). Keeping a valid NUL-terminated ascii region means the offset
  //   is always pointing at a parseable empty string.
  const asciiPath = useUnicode
    ? Buffer.from([0x00])
    : Buffer.concat([Buffer.from(targetPath, 'ascii'), Buffer.from([0x00])]);

  // UTF-16 LocalBasePathUnicode segment (only present when useUnicode).
  const unicodePath = useUnicode
    ? Buffer.concat([Buffer.from(targetPath, 'utf16le'), Buffer.from([0x00, 0x00])])
    : Buffer.alloc(0);

  // CommonPathSuffix (ascii) and CommonPathSuffixUnicode (utf16):
  // both empty strings. The parser always appends the suffix to the path,
  // so we need explicit empty terminators rather than reusing the path bytes.
  const asciiSuffix = Buffer.from([0x00]);
  const unicodeSuffix = useUnicode ? Buffer.from([0x00, 0x00]) : Buffer.alloc(0);

  const localPathOffset = headerSize;
  const unicodePathOffset = useUnicode ? localPathOffset + asciiPath.length : 0;
  const asciiSuffixOffset = useUnicode
    ? unicodePathOffset + unicodePath.length
    : localPathOffset + asciiPath.length;
  const unicodeSuffixOffset = useUnicode ? asciiSuffixOffset + asciiSuffix.length : 0;

  const totalSize =
    headerSize +
    asciiPath.length +
    (useUnicode ? unicodePath.length : 0) +
    asciiSuffix.length +
    (useUnicode ? unicodeSuffix.length : 0);

  const linkInfo = Buffer.alloc(totalSize);
  linkInfo.writeInt32LE(totalSize, 0); // LinkInfoSize
  linkInfo.writeInt32LE(headerSize, 4); // LinkInfoHeaderSize
  linkInfo.writeInt32LE(0x1, 8); // LinkInfoFlags: VolumeIDAndLocalBasePath
  linkInfo.writeInt32LE(0, 12); // VolumeIDOffset
  linkInfo.writeInt32LE(localPathOffset, 16); // LocalBasePathOffset
  linkInfo.writeInt32LE(0, 20); // CommonNetworkRelativeLinkOffset
  linkInfo.writeInt32LE(asciiSuffixOffset, 24); // CommonPathSuffixOffset → empty string
  if (useUnicode) {
    linkInfo.writeInt32LE(unicodePathOffset, 28); // LocalBasePathUnicodeOffset
    linkInfo.writeInt32LE(unicodeSuffixOffset, 32); // CommonPathSuffixUnicodeOffset → empty
  }
  asciiPath.copy(linkInfo, localPathOffset);
  if (useUnicode) {
    unicodePath.copy(linkInfo, unicodePathOffset);
  }
  asciiSuffix.copy(linkInfo, asciiSuffixOffset);
  if (useUnicode) {
    unicodeSuffix.copy(linkInfo, unicodeSuffixOffset);
  }

  return Buffer.concat([header, idListSize, idListTerm, linkInfo]);
}
