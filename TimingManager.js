
function durationOf(minutes, seconds){
    return minutes * 60 + seconds;
}
TimingModel = Backbone.Model.extend({
    defaults: {
        globalTime: 0,
        globalOverflow: 0,
        plannedDuration: 0,
        slideCountdown: 0,

        currentSlide: 0,

        resumeTS: null, // == paused
        slidesRemainingBaseTime: 0
    },

    reset: function(){
        this.set({ slideCountdown: this.currentSlideTiming().estimatedDuration*1000 });

        var plannedTotalDuration = 0;
        for(var i=0; i<this.get("slideTimings").length; i++){
            plannedTotalDuration += this.get("slideTimings")[i].estimatedDuration * 1000;
        }
        this.set({
            plannedDuration: plannedTotalDuration,
            slidesRemainingBaseTime: plannedTotalDuration
        });
    },

    resume: function(){
        this.set({ resumeTS: new Date() });
    },

    pause: function(){
        this.update();
        this.set({ resumeTS: null });
    },

    resumeOrPause: function(){
        if(!this.get("resumeTS")){ this.resume(); }
        else { this.pause(); }
    },

    remainingTime: function(){
        return this.get("slidesRemainingBaseTime")
            - ((this.currentSlideTiming().estimatedDuration*1000) - (this.get("slideCountdown")>0?this.get("slideCountdown"):0));
    },

    plannedEndTime: function(){
        return this.get("latestTick") + this.remainingTime();
    },

    pauseResumeLabel: function(){
        return this.get("resumeTS")?"Pause":"Resume";
    },

    globalOverflowClass: function(){
        return this.globalSummedOverflow() < 0?"bad":"good";
    },

    globalSummedOverflow: function(){
        return this.get("globalOverflow") + (this.get("slideCountdown")<0?this.get("slideCountdown"):0);
    },

    plannedSummedDuration: function(){
        return this.get("plannedDuration") - (this.get("slideCountdown")<0?this.get("slideCountdown"):0);
    },

    slideCountdownClass: function(){
        return this.get("slideCountdown") < 0?"bad":"";
    },

    update: function(){
        this.set({ latestTick: new Date().getTime() });
        if(!this.get("resumeTS")){
            return;
        }

        var newTS = new Date();
        var delta = newTS.getTime() - this.get("resumeTS").getTime();
        this.set({ resumeTS: newTS });

        this.set({
            globalTime: this.get("globalTime") + delta,
            slideCountdown: this.get("slideCountdown") - delta
        });
    },

    nextSlide: function(){
        this.currentSlideTiming().realDuration = this.currentSlideTiming().estimatedDuration * 1000 - this.get("slideCountdown");
        this.currentSlideTiming().delta = Math.round(this.get("slideCountdown") / 1000);

        window.timingsModel.add({
            duration: this.currentSlideTiming().realDuration,
            slideCountdown: this.get("slideCountdown")
        });

        this.set({
            globalOverflow: this.get("globalOverflow") + this.get("slideCountdown"),
            currentSlide: this.get("currentSlide")+1,
            plannedDuration: this.get("plannedDuration") - this.get("slideCountdown"),
            slidesRemainingBaseTime: this.get("slidesRemainingBaseTime") - (this.currentSlideTiming().estimatedDuration * 1000)
        });
        this.set({
            slideCountdown: this.currentSlideTiming().estimatedDuration * 1000
        })
    },

    currentSlideTiming: function(){ return this.get("slideTimings")[this.get("currentSlide")]; }
});

TimingsCollection = Backbone.Collection.extend({
    model: Backbone.Model.extend({
        deltaClass: function(){
            return this.get("slideCountdown")>0?"good":"bad";
        }
    })
});

function bootstrapTimings(){
    SLIDE_TIMINGS = $(".slide").map(function(idx, $slideEl){
        var rawDuration = $($slideEl).attr('data-estimatedDuration');
        var durationChunks = rawDuration.split(":");
        return { estimatedDuration: durationOf(Number(durationChunks[0]), Number(durationChunks[1])) };
    });

    function dateToHHMMSS(timestamp){
        // Having to pass through a date object to convert to non utc time
        var time = new Date(timestamp);
        return toHHMMSS((time.getSeconds() + (time.getMinutes() * 60) + (time.getHours() * 60 * 60))*1000);
    }

    function toHHMMSS(timestamp){
        var sec_numb = Math.round(timestamp/1000);
        var sign="";
        if(sec_numb < 0){
            sign="-";
            sec_numb *= -1;
        }
        var hours   = Math.floor(sec_numb / 3600);
        var minutes = Math.floor((sec_numb - (hours * 3600)) / 60);
        var seconds = sec_numb - (hours * 3600) - (minutes * 60);

        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        var time    = sign+hours+':'+minutes+':'+seconds;
        return time;
    }

    window.timingModel = new TimingModel({ slideTimings: SLIDE_TIMINGS });
    window.timingsModel = new TimingsCollection();

    rivets.formatters.toHHMMSS = toHHMMSS;
    rivets.formatters.dateToHHMMSS = dateToHHMMSS;
    rivets.bind($(".container"), { timingModel: window.timingModel, timings: timingsModel });
    window.timingModel.reset();

    // Here, you can specify refresh rate...
    setInterval(_.bind(timingModel.update, timingModel), 1000);

    $(".pauseResume").click(function(){
        timingModel.resumeOrPause();
    });

    $(".nextSlide").click(function(){
        var visibleSlide = $(".slide.visible");
        visibleSlide.removeClass("visible");

        window.timingModel.nextSlide();

        visibleSlide.next().addClass("visible");
    });
}