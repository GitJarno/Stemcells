// A user message's pictures: one row the person swipes, the same row while the message is
// pending and once it's sent. A picture this phone sent keeps showing its own file until the
// server's copy has loaded, so a send never stacks, blanks or spins its pictures.

import { Image } from "expo-image";
import { useEffect, useId, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { attachmentLabeller } from "../upstream/attachments";
import {
  AppActivityIndicator,
  assetImageSource,
  type ChatAttachment,
  composerImageGallery,
  type DraftComposerAttachment,
  type EnvironmentId,
  type FilePreviewItem,
  type FilePreviewSource,
  PresentationSource,
  useAssetUrl,
  useFilePreviewGallery,
  useRefreshAssetUrl,
} from "../upstream/messageImages";
import { rememberSentImages, type SentImage, sentImages } from "./sentImages";

const TILE = "h-24 w-24 rounded-[14px] bg-user-bubble-foreground/15";

export function MessageImages(props: {
  readonly environmentId: EnvironmentId;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly pending: ReadonlyArray<DraftComposerAttachment> | undefined;
  readonly onPressPreview: (source: FilePreviewSource) => void;
}) {
  const { environmentId } = props;
  const images = sentImages(environmentId, props.attachments, props.pending ?? []);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep each uploaded picture's own file in the session's store, where its sent message finds it.
  useEffect(() => rememberSentImages(environmentId, images), [environmentId, images]);
  if (images.length === 0) return null;
  const labelOf = attachmentLabeller(
    props.attachments.length > 0 ? props.attachments : (props.pending ?? []),
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2"
    >
      {images.map((image) => (
        <SentImageTile
          key={image.key}
          environmentId={environmentId}
          image={image}
          label={labelOf(image)}
          onPressPreview={props.onPressPreview}
        />
      ))}
    </ScrollView>
  );
}

function SentImageTile(props: {
  readonly environmentId: EnvironmentId;
  readonly image: SentImage;
  readonly label: string;
  readonly onPressPreview: (source: FilePreviewSource) => void;
}) {
  const { environmentId, image } = props;
  const withGallery = useFilePreviewGallery();
  const sourceIdentifier = useId();
  const resource =
    image.attachmentId === null
      ? null
      : {
          _tag: "attachment" as const,
          attachmentId: image.attachmentId,
          fileName: image.name,
          mimeType: image.mimeType,
        };
  const uri = useAssetUrl(environmentId, resource);
  const refreshAssetUrl = useRefreshAssetUrl(environmentId, resource);
  const retriedImage = useRef(false);
  const imageStyle = useResolveClassNames(TILE);

  if (uri === null && image.localUri === null) {
    return (
      <View className={`${TILE} items-center justify-center`}>
        <AppActivityIndicator />
      </View>
    );
  }

  const [draft] = image.draft === null ? [] : composerImageGallery([image.draft]);
  const viewed: FilePreviewItem | undefined =
    resource === null
      ? draft
      : {
          kind: "image",
          environmentId,
          resource,
          name: image.name,
          actionsSource: { name: image.name, mimeType: image.mimeType, environmentId, resource },
        };

  return (
    <PresentationSource identifier={sourceIdentifier}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Open ${props.label}`}
        disabled={viewed === undefined}
        onPress={() => viewed && props.onPressPreview(withGallery({ ...viewed, sourceIdentifier }))}
      >
        <Image
          source={
            uri === null || resource === null
              ? null
              : assetImageSource(environmentId, resource, uri)
          }
          placeholder={image.localUri === null ? null : { uri: image.localUri }}
          placeholderContentFit="cover"
          cachePolicy="memory-disk"
          style={imageStyle}
          contentFit="cover"
          onLoad={() => {
            retriedImage.current = false;
          }}
          onError={() => {
            if (retriedImage.current) return;
            retriedImage.current = true;
            void refreshAssetUrl();
          }}
        />
      </Pressable>
    </PresentationSource>
  );
}
