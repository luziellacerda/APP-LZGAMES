"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const test=require("node:test");

test("reencodes five photos and a short video into bounded public media",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"lz-market-media-"));
  process.env.MARKETPLACE_MEDIA_ROOT=path.join(root,"media");
  process.env.MARKETPLACE_TMP_ROOT=path.join(root,"tmp");
  const media=require("../lib/marketplaceMedia");
  try{
    await media.ensureStorage();
    const image=path.join(root,"source.png"),video=path.join(root,"source.mov");
    assert.equal(spawnSync("/usr/bin/ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","color=c=blue:s=320x240:d=1","-frames:v","1",image]).status,0);
    assert.equal(spawnSync("/usr/bin/ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","testsrc=size=320x180:rate=12","-t","1","-c:v","libx264","-pix_fmt","yuv420p",video]).status,0);
    const result=await media.processUpload({photos:Array.from({length:5},()=>({path:image})),video:{path:video}},"123e4567-e89b-42d3-a456-426614174000");
    assert.equal(result.media.length,6);
    assert.equal(result.media.filter(item=>item.kind==="image").length,5);
    assert.equal(result.media.filter(item=>item.kind==="video").length,1);
    for(const item of result.media){assert.ok(item.bytes>100);assert.match(item.storageName,/^[0-9a-f-]+\.(?:jpg|mp4)$/);}
    const videoResult=result.media.find(item=>item.kind==="video");
    assert.ok(videoResult.durationMs<=30000);
    assert.match(videoResult.posterName,/^[0-9a-f-]+-poster\.jpg$/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
